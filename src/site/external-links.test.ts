/**
 * External link checking that scales: each target once per run, a refusal
 * never read as broken, a budget that never changes the status, and every
 * `[external_links]` key doing what it says.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Auditor, type AuditorOptions } from '../auditor.js';
import { LinkCache } from '../storage/link-cache.js';
import { getDefaultConfig } from '../config/defaults.js';
import { externalLinksOptions } from '../commands/run-config.js';
import type { AuditResult, RuleResult } from '../types.js';
import type { ExternalLinksExtras } from './external-links.js';

const ORIGIN = 'https://site.test';

interface Site {
  pages: number;
  /** External hrefs on every page */
  external: string[];
  /** Answer per external URL; default 200 */
  answers?: Record<string, number | { status: number; headers?: Record<string, string> }>;
  /** Milliseconds before an external URL answers */
  externalDelayMs?: Record<string, number>;
}

function html(path: string, site: Site): string {
  const internal =
    path === '/' ? Array.from({ length: site.pages - 1 }, (_, i) => `<a href="/p${i + 1}">Page ${i + 1}</a>`).join(' ') : '<a href="/">Home</a>';
  const external = site.external.map((href, i) => `<a href="${href}">Partner ${i}</a>`).join(' ');
  return `<!doctype html><html lang="en"><head><title>Page ${path}</title></head><body><main>${internal}</main><footer>${external}</footer></body></html>`;
}

/** A stubbed web: the site's pages, and external hosts that count their requests */
function serve(site: Site) {
  const external: Array<{ method: string; url: string }> = [];
  let inFlight = 0;
  const peak = { value: 0 };
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const method = init?.method ?? 'GET';
      if (url.startsWith(ORIGIN)) {
        const path = new URL(url).pathname;
        const known = path === '/' || /^\/p\d+$/.test(path);
        if (!known) return new Response(null, { status: 404 });
        return new Response(method === 'HEAD' ? null : html(path, site), { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } });
      }
      external.push({ method, url });
      inFlight++;
      peak.value = Math.max(peak.value, inFlight);
      try {
        const delay = site.externalDelayMs?.[url] ?? 5;
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(resolve, delay);
          init?.signal?.addEventListener('abort', () => {
            clearTimeout(timer);
            reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
          });
        });
        const answer = site.answers?.[url] ?? 200;
        const { status, headers } = typeof answer === 'number' ? { status: answer, headers: {} } : answer;
        return new Response(null, { status, headers });
      } finally {
        inFlight--;
      }
    })
  );
  return { external, peak };
}

const ruleResults = (result: AuditResult): RuleResult[] =>
  result.categoryResults.flatMap((c) => c.results).filter((r) => r.ruleId === 'links-external-valid');
const report = (result: AuditResult) => result.extras?.externalLinks as ExternalLinksExtras | undefined;

function auditor(options: AuditorOptions = {}) {
  return new Auditor({ measureCwv: false, categories: ['links'], ...options });
}

const dirs: string[] = [];
function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'seomator-ext-'));
  dirs.push(dir);
  return dir;
}

// Every test gets its own home: the configured link cache must never land
// in the real ~/.seomator, and one test's cached answers must not reach the next
beforeEach(() => {
  process.env['SEOMATOR_HOME'] = tempDir();
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env['SEOMATOR_HOME'];
  while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true });
});

const FIVE = ['a', 'b', 'c', 'd', 'e'].map((x) => `https://partner-${x}.test/`);

describe('each external target is checked once per run', () => {
  it('sends 5 requests for a 50-page crawl where every page links the same 5 URLs', async () => {
    const { external } = serve({ pages: 50, external: FIVE });
    const result = await auditor().auditWithCrawl(`${ORIGIN}/`, 50, 4);
    expect(result.crawledPages).toBe(50);
    expect(external.map((r) => `${r.method} ${r.url}`).sort()).toEqual(FIVE.map((u) => `HEAD ${u}`).sort());
    expect(ruleResults(result).every((r) => r.status === 'pass')).toBe(true);
  });

  it('checks every external link on a single page, not the first 20', async () => {
    const many = Array.from({ length: 25 }, (_, i) => `https://partner-${i}.test/`);
    const { external } = serve({ pages: 1, external: many });
    const result = await auditor().audit(`${ORIGIN}/`);
    expect(new Set(external.map((r) => r.url)).size).toBe(25);
    expect(ruleResults(result)[0].details).toMatchObject({ totalChecked: 25 });
  });
});

describe('a refusal is not a broken link', () => {
  it('counts only the gone target as broken, and lists 999 and 429 as could not verify', async () => {
    const [ok, gone, linkedin, limited] = FIVE;
    serve({
      pages: 3,
      external: [ok, gone, linkedin, limited],
      answers: { [gone]: 404, [linkedin]: 999, [limited]: { status: 429, headers: { 'retry-after': '0' } } },
    });
    const result = await auditor().auditWithCrawl(`${ORIGIN}/`, 3, 2);
    for (const r of ruleResults(result)) {
      expect(r.status).toBe('warn');
      expect(r.details).toMatchObject({ brokenCount: 1, couldNotVerifyCount: 2 });
      expect(r.message).toContain('1 broken external link(s) out of 2 checked');
    }
    const ext = report(result)!;
    expect(ext).toMatchObject({ checked: 4, broken: 1, couldNotVerify: 2 });
    expect(ext.brokenTargets[0]).toMatchObject({ url: gone, status: 404, linkedFromCount: 3 });
    expect(ext.brokenTargets[0].linkedFrom).toHaveLength(3);
  });
});

describe('the budget', () => {
  it('reports targets past max_urls as not checked, and they never change the status', async () => {
    const { external } = serve({ pages: 2, external: FIVE, answers: { [FIVE[4]]: 404 } });
    const result = await auditor({ ruleOptions: { 'links-external-valid': { max_urls: 2 } } }).auditWithCrawl(`${ORIGIN}/`, 2, 1);
    expect(external).toHaveLength(2);
    const [first] = ruleResults(result);
    expect(first.status).toBe('pass');
    expect(first.details).toMatchObject({ notChecked: 3 });
    expect(first.message).toContain('3 not checked');
    expect(report(result)).toMatchObject({ checked: 2, notChecked: 3 });
  });

  it('stops at max_seconds and keeps what it learned', async () => {
    const [fast, , , , slow] = FIVE;
    serve({ pages: 2, external: [fast, slow], externalDelayMs: { [slow]: 30_000 } });
    const result = await auditor({ ruleOptions: { 'links-external-valid': { max_seconds: 5 } } }).auditWithCrawl(`${ORIGIN}/`, 2, 1);
    expect(report(result)).toMatchObject({ checked: 1, notChecked: 1 });
    expect(ruleResults(result)[0].status).toBe('pass');
  }, 15_000);
});

describe('[external_links] keys, end to end', () => {
  it('enabled = false requests nothing and leaves the rule not measured', async () => {
    const config = getDefaultConfig();
    config.external_links.enabled = false;
    const { external } = serve({ pages: 1, external: FIVE });
    const result = await auditor({ externalLinks: externalLinksOptions(config) }).audit(`${ORIGIN}/`);
    expect(external).toHaveLength(0);
    expect(ruleResults(result)[0]).toMatchObject({ status: 'not-measured', reason: 'disabled' });
  });

  it('timeout_ms turns a slow target into could not verify, never broken', async () => {
    const config = getDefaultConfig();
    config.external_links.timeout_ms = 1000;
    const [fast, slow] = FIVE;
    serve({ pages: 1, external: [fast, slow], externalDelayMs: { [slow]: 5_000 } });
    const result = await auditor({ externalLinks: externalLinksOptions(config) }).audit(`${ORIGIN}/`);
    const [rule] = ruleResults(result);
    expect(rule.status).toBe('pass');
    expect(rule.details).toMatchObject({ couldNotVerifyCount: 1, couldNotVerify: [{ href: slow, reason: 'timed out' }] });
  }, 15_000);

  it('concurrency caps the external requests in flight', async () => {
    const config = getDefaultConfig();
    config.external_links.concurrency = 2;
    const hosts = Array.from({ length: 8 }, (_, i) => `https://host-${i}.test/`);
    const { peak } = serve({ pages: 1, external: hosts, externalDelayMs: Object.fromEntries(hosts.map((h) => [h, 40])) });
    await auditor({ externalLinks: externalLinksOptions(config) }).audit(`${ORIGIN}/`);
    expect(peak.value).toBe(2);
  });

  it('cache_ttl_days keeps settled answers between runs; 0 keeps none', async () => {
    const config = getDefaultConfig();
    const { external } = serve({ pages: 1, external: FIVE, answers: { [FIVE[0]]: 404 } });
    await auditor({ externalLinks: externalLinksOptions(config) }).audit(`${ORIGIN}/`);
    expect(external).toHaveLength(6); // HEAD each, plus GET confirming the 404
    const second = await auditor({ externalLinks: externalLinksOptions(config) }).audit(`${ORIGIN}/`);
    expect(external).toHaveLength(6);
    expect(report(second)).toMatchObject({ fromCache: 5, broken: 1 });

    config.external_links.cache_ttl_days = 0;
    await auditor({ externalLinks: externalLinksOptions(config) }).audit(`${ORIGIN}/`);
    expect(external).toHaveLength(12);
  });
});

describe('--refresh', () => {
  it('changes the request count on a second run', async () => {
    const cache = new LinkCache({ dbPath: join(tempDir(), 'links.db'), ttlDays: 7 });
    const { external } = serve({ pages: 2, external: FIVE });
    const run = (refresh: boolean) => auditor({ externalLinks: { cache, refresh } }).auditWithCrawl(`${ORIGIN}/`, 2, 1);
    await run(false);
    expect(external).toHaveLength(5);
    await run(false);
    expect(external).toHaveLength(5);
    await run(true);
    expect(external).toHaveLength(10);
    cache.close();
  });
});

describe('a stored crawl replayed by analyze', () => {
  it('runs its link checks under the network policy an audit would have', async () => {
    const { external } = serve({ pages: 1, external: ['http://169.254.169.254/latest/meta-data/'] });
    // The stub never reaches the network, so the guard is observed through
    // the policy the checks ran under: a public target means strict
    const { currentNetPolicy } = await import('../net/policy.js');
    const seen: boolean[] = [];
    const fetchStub = globalThis.fetch;
    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
      seen.push(currentNetPolicy().blockPrivate);
      return fetchStub(input, init);
    });
    const page = { url: 'https://example.com/', links: [{ href: 'http://169.254.169.254/latest/meta-data/', text: 'x', isInternal: false, isNoFollow: false }] };
    const context = { url: page.url, links: page.links, $: (await import('cheerio')).load('<html></html>'), html: '', headers: {}, statusCode: 200 } as never;
    await auditor().auditPages([{ url: page.url, context }]);
    expect(external.length).toBeGreaterThan(0);
    expect(seen.every(Boolean)).toBe(true);
  });
});
