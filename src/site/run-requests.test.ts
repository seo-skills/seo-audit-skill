/**
 * A crawl asks each site-wide question once. robots.txt, the made-up URL that
 * tests the 404 page, the GEO well-known files and a PDF every page links to
 * used to be requested by every page's rules: twenty pages, twenty times each.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Auditor } from '../auditor.js';

const ORIGIN = 'https://site.test';
const PAGES = 20;

function html(path: string): string {
  const nav = path === '/' ? Array.from({ length: PAGES - 1 }, (_, i) => `<a href="/p${i + 1}">Page ${i + 1}</a>`).join(' ') : '<a href="/">Home</a>';
  return `<!doctype html><html lang="en"><head><title>Page ${path} of the test site</title>
<link rel="canonical" href="${ORIGIN}${path}"></head>
<body><main><h1>Page ${path}</h1>${nav} <a href="/files/guide.pdf">Guide</a></main></body></html>`;
}

function serve(mdDelay: (page: number) => number = () => 0) {
  const requests: string[] = [];
  let mdInFlight = 0;
  const mdPeak = { value: 0 };
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const method = init?.method ?? 'GET';
      const path = new URL(url).pathname;
      requests.push(`${method} ${path}`);
      if (path === '/' || /^\/p\d+$/.test(path)) {
        return new Response(method === 'HEAD' ? null : html(path), { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } });
      }
      if (path === '/robots.txt') return new Response('User-agent: *\nAllow: /\n', { status: 200, headers: { 'content-type': 'text/plain' } });
      const md = path.match(/^\/p(\d+)\.md$/);
      if (md) {
        mdInFlight++;
        mdPeak.value = Math.max(mdPeak.value, mdInFlight);
        await new Promise((r) => setTimeout(r, mdDelay(Number(md[1]))));
        mdInFlight--;
        return new Response('Not found', { status: 404, headers: { 'content-type': 'text/html' } });
      }
      if (path === '/files/guide.pdf') return new Response(null, { status: 200, headers: { 'content-type': 'application/pdf', 'content-length': '2048' } });
      return new Response('Not found', { status: 404, headers: { 'content-type': 'text/html' } });
    })
  );
  return Object.assign(requests, { mdPeak });
}

const dirs: string[] = [];
beforeEach(() => {
  const dir = mkdtempSync(join(tmpdir(), 'seomator-run-'));
  dirs.push(dir);
  process.env['SEOMATOR_HOME'] = dir;
});
afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env['SEOMATOR_HOME'];
  while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true });
});

describe('site-wide questions are asked once per run', () => {
  it('requests each probe once across a 20-page crawl, not once per page', async () => {
    const requests = serve();
    const result = await new Auditor({ measureCwv: false }).auditWithCrawl(`${ORIGIN}/`, PAGES, 4);
    expect(result.crawledPages).toBe(PAGES);

    const count = (pattern: RegExp) => requests.filter((r) => pattern.test(r)).length;
    // The 404 test URL: one per run, where every page used to make its own
    expect(count(/seo-audit-test-nonexistent-page/)).toBe(1);
    // The PDF every page links to: one status check (shared by the size and
    // broken-link rules) and one redirect hop
    expect(count(/^HEAD \/files\/guide\.pdf$/)).toBe(2);
    // GEO probes: one request per file
    for (const file of ['/AGENTS.md', '/.well-known/agent.json', '/.well-known/mcp.json', '/index.md']) {
      expect(count(new RegExp(`^GET ${file.replace(/\./g, '\\.')}$`)), file).toBe(1);
    }
    // robots.txt and the sitemap: the crawler and the audit read them, and
    // every page's rules share one more answer
    expect(count(/^GET \/robots\.txt$/)).toBeLessThanOrEqual(3);
    expect(count(/^GET \/sitemap\.xml$/)).toBeLessThanOrEqual(3);
  });
});

describe('pages are scored a few at a time', () => {
  const summary = (result: Awaited<ReturnType<Auditor['auditWithCrawl']>>) =>
    result.categoryResults.map((c) => [c.categoryId, c.score, c.results.map((r) => `${r.ruleId}:${r.status}:${r.details?.['pageUrl']}`)]);

  it('overlaps pages, and gives the same result whichever page finishes first', async () => {
    const slowFirst = serve((page) => (PAGES - page) * 15);
    const a = await new Auditor({ measureCwv: false, categories: ['geo', 'links'] }).auditWithCrawl(`${ORIGIN}/`, PAGES, 4);
    expect(slowFirst.mdPeak.value).toBeGreaterThan(1);
    vi.unstubAllGlobals();

    serve((page) => page * 15);
    const b = await new Auditor({ measureCwv: false, categories: ['geo', 'links'] }).auditWithCrawl(`${ORIGIN}/`, PAGES, 4);
    expect(summary(b)).toEqual(summary(a));
    expect(b.overallScore).toBe(a.overallScore);
  });
});
