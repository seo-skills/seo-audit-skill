/**
 * A crawl is capped by its start page, and a staging audit waives that cap.
 *
 * Before this, a crawl was never capped. The same five-page site, noindex on
 * every page, scored 20 in a single-page audit and 92 in a crawl; behind
 * `Disallow: /` it scored 93 from the one page robots.txt let the crawler
 * fetch. Those are the two classic launch accidents — staging settings
 * shipped to production — and the mode meant to check a whole site missed
 * both. A noindex page somewhere inside a site is usually deliberate (a
 * login, a thank-you page), so only the start page caps the crawl.
 *
 * Every site below is the same five pages on the same stubbed server; only
 * indexability differs.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { Auditor } from './auditor.js';
import type { AuditResult } from './types.js';

const ORIGIN = 'https://site.test';
const PATHS = ['/', '/widgets', '/testing', '/ordering', '/about'];

const paragraph = (n: number) =>
  `<p>Widgets are small mechanical parts used on assembly lines across many industries, and section ${n} explains how our engineers choose materials, test tolerances, and ship orders on time to customers who depend on a reliable supply.</p>`;

function page(path: string, noindex: boolean): string {
  const name = path === '/' ? 'Home' : path.slice(1);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
${noindex ? '<meta name="robots" content="noindex">' : ''}
<title>Acme ${name} — Acme Supply</title>
<meta name="description" content="Acme Supply ${name}: how we make industrial widgets, explained by the engineers who build them every day.">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="canonical" href="${ORIGIN}${path}">
</head><body>
<header><nav>${PATHS.map((p) => `<a href="${p}">${p === '/' ? 'Home' : p.slice(1)}</a>`).join(' ')}</nav></header>
<main><h1>Acme ${name}</h1>${[1, 2, 3, 4, 5, 6, 7].map(paragraph).join('')}</main>
<footer>© 2026 Acme Supply</footer>
</body></html>`;
}

const HEADERS = {
  'content-type': 'text/html; charset=utf-8',
  'strict-transport-security': 'max-age=31536000',
  'x-frame-options': 'DENY',
  'x-content-type-options': 'nosniff',
  'content-security-policy': "default-src 'self'",
  'referrer-policy': 'strict-origin-when-cross-origin',
};

interface Site {
  noindex?: (path: string) => boolean;
  robots?: string;
}

function serve({ noindex = () => false, robots = 'User-agent: *\nAllow: /\n' }: Site) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const head = (init?.method ?? 'GET') === 'HEAD';
    const path = url.startsWith(ORIGIN) ? new URL(url).pathname : null;
    if (path && PATHS.includes(path)) {
      return new Response(head ? null : page(path, noindex(path)), { status: 200, headers: HEADERS });
    }
    if (path === '/robots.txt') {
      return new Response(robots, { status: 200, headers: { 'content-type': 'text/plain' } });
    }
    return new Response(null, { status: 404 });
  });
}

async function crawl(site: Site, staging = false): Promise<AuditResult> {
  vi.stubGlobal('fetch', serve(site));
  return new Auditor({ measureCwv: false, staging }).auditWithCrawl(`${ORIGIN}/`, 10, 2);
}

async function single(site: Site, staging = false): Promise<AuditResult> {
  vi.stubGlobal('fetch', serve(site));
  return new Auditor({ measureCwv: false, staging }).audit(`${ORIGIN}/`);
}

const capIds = (result: AuditResult) => result.scoreCap?.caps.map((cap) => cap.id) ?? [];
const waivedIds = (result: AuditResult) => result.waivedCaps?.map((cap) => cap.id) ?? [];

const EVERY_PAGE_NOINDEX: Site = { noindex: () => true };
const DISALLOW_ALL: Site = { robots: 'User-agent: *\nDisallow: /\n' };
const STAGING: Site = { noindex: () => true, robots: 'User-agent: *\nDisallow: /\n' };

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('a crawl is capped by its start page', () => {
  it('leaves a healthy site uncapped', async () => {
    const result = await crawl({});
    expect(result.scoreCap).toBeUndefined();
    expect(result.crawledPages).toBe(5);
    expect(result.overallScore).toBeGreaterThanOrEqual(85);
  }, 30_000);

  it('leaves a deliberate noindex page inside the site uncapped', async () => {
    const healthy = await crawl({});
    const result = await crawl({ noindex: (path) => path === '/about' });
    expect(result.scoreCap).toBeUndefined();
    expect(Math.abs(result.overallScore - healthy.overallScore)).toBeLessThanOrEqual(2);
  }, 30_000);

  it('fails a site whose start page is noindex, and names the page', async () => {
    const result = await crawl({ noindex: (path) => path === '/' });
    expect(result.overallScore).toBe(20);
    expect(capIds(result)).toEqual(['noindex']);
    expect(result.scoreCap?.caps[0].reason).toContain(`the start page (${ORIGIN}/)`);
  }, 30_000);

  it('fails a site that is noindex on every page', async () => {
    const result = await crawl(EVERY_PAGE_NOINDEX);
    expect(result.overallScore).toBe(20);
    expect(capIds(result)).toEqual(['noindex']);
  }, 30_000);

  it('fails a site behind Disallow: /, which it could crawl one page of', async () => {
    const result = await crawl(DISALLOW_ALL);
    expect(result.crawledPages).toBe(1);
    expect(result.overallScore).toBe(20);
    expect(capIds(result)).toEqual(['robots-disallowed']);
  }, 30_000);

  it('agrees with a single-page audit of the same broken site', async () => {
    for (const site of [EVERY_PAGE_NOINDEX, DISALLOW_ALL]) {
      expect((await crawl(site)).overallScore).toBe((await single(site)).overallScore);
    }
  }, 60_000);
});

describe('staging', () => {
  it('crawls a blocked staging site past robots.txt and scores it as if live', async () => {
    const healthy = await crawl({});
    const result = await crawl(STAGING, true);
    expect(result.crawledPages).toBe(5);
    expect(result.scoreCap).toBeUndefined();
    // The noindex rules still report on every page; the score stays close.
    expect(result.overallScore).toBeGreaterThanOrEqual(healthy.overallScore - 5);
  }, 30_000);

  it('lists what it waived, as the launch checklist', async () => {
    const result = await crawl(STAGING, true);
    expect(waivedIds(result)).toEqual(['noindex', 'robots-disallowed']);
    expect(result.waivedCaps?.[0].reason).toContain('Remove it at launch');
  }, 30_000);

  it('waives a single-page audit too, but keeps its content caps', async () => {
    const result = await single(STAGING, true);
    expect(result.scoreCap).toBeUndefined();
    expect(result.overallScore).toBeGreaterThanOrEqual(85);
    expect(waivedIds(result)).toEqual(['noindex', 'robots-disallowed']);
  }, 30_000);

  it('is recorded on the run, so compare can tell staging from production', async () => {
    expect((await crawl(STAGING, true)).run?.staging).toBe(true);
    expect((await crawl({})).run).not.toHaveProperty('staging');
  }, 30_000);

  it('changes nothing on a site that is not blocked', async () => {
    const production = await crawl({});
    const staged = await crawl({}, true);
    expect(staged.overallScore).toBe(production.overallScore);
    expect(staged.waivedCaps).toBeUndefined();
  }, 30_000);
});
