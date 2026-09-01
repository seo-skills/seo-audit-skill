import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createAuditor, Auditor } from './index.js';
import { markSitemapDiscoverySources } from './auditor.js';
import { categories } from './categories/index.js';
import type { SiteContext, SitemapFetchResult } from './types.js';

const PAGE_URL = 'https://example.test/';

const FIXTURE_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Integration Test Page</title>
  <meta name="description" content="Fixture page for the programmatic Auditor integration test.">
  <link rel="canonical" href="${PAGE_URL}">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body>
  <h1>Integration Test Page</h1>
  <p>Body content for the audit fixture.</p>
</body>
</html>`;

function makeFetchStub() {
  return vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url === PAGE_URL) {
      return new Response(FIXTURE_HTML, {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' },
      });
    }
    // robots.txt and sitemap.xml — auditor catches and ignores failures
    return new Response('', { status: 404 });
  });
}

describe('Programmatic API (createAuditor / Auditor)', () => {
  let fetchStub: ReturnType<typeof makeFetchStub>;

  beforeEach(() => {
    fetchStub = makeFetchStub();
    vi.stubGlobal('fetch', fetchStub);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('exports createAuditor and Auditor from the package entry', () => {
    expect(typeof createAuditor).toBe('function');
    expect(typeof Auditor).toBe('function');
  });

  it('defaults to all 20 categories when no filter is given', () => {
    const auditor = createAuditor();
    expect(auditor.getCategoriesToAudit()).toHaveLength(categories.length);
    expect(categories.length).toBe(20);
  });

  it('filters categories when categories option is provided', () => {
    const auditor = createAuditor({ categories: ['core', 'security'] });
    const ids = auditor.getCategoriesToAudit().map((c) => c.id);
    expect(ids).toEqual(['core', 'security']);
  });

  it('audit() returns an AuditResult with the documented shape', async () => {
    const auditor = createAuditor({ categories: ['core'], measureCwv: false });
    const result = await auditor.audit(PAGE_URL);

    expect(result.url).toBe(PAGE_URL);
    expect(typeof result.overallScore).toBe('number');
    expect(result.overallScore).toBeGreaterThanOrEqual(0);
    expect(result.overallScore).toBeLessThanOrEqual(100);
    expect(typeof result.timestamp).toBe('string');
    expect(() => new Date(result.timestamp)).not.toThrow();
    expect(result.crawledPages).toBe(1);

    expect(Array.isArray(result.categoryResults)).toBe(true);
    expect(result.categoryResults).toHaveLength(1);

    const core = result.categoryResults[0];
    expect(core.categoryId).toBe('core');
    expect(core.score).toBeGreaterThanOrEqual(0);
    expect(core.score).toBeLessThanOrEqual(100);
    expect(core.passCount + core.warnCount + core.failCount).toBe(core.results.length);
    expect(core.results.length).toBeGreaterThan(0);

    for (const ruleResult of core.results) {
      expect(['pass', 'warn', 'fail']).toContain(ruleResult.status);
      expect(ruleResult.ruleId).toMatch(/^core-/);
      expect(ruleResult.details?.pageUrl).toBe(PAGE_URL);
    }
  });

  it('fires lifecycle callbacks in the documented order', async () => {
    const events: string[] = [];
    const auditor = createAuditor({
      categories: ['core'],
      measureCwv: false,
      onCategoryStart: (id) => events.push(`start:${id}`),
      onRuleComplete: (ruleId) => events.push(`rule:${ruleId}`),
      onCategoryComplete: (id) => events.push(`complete:${id}`),
    });

    await auditor.audit(PAGE_URL);

    expect(events[0]).toBe('start:core');
    expect(events[events.length - 1]).toBe('complete:core');
    const ruleEvents = events.filter((e) => e.startsWith('rule:'));
    expect(ruleEvents.length).toBeGreaterThan(0);
    // Every rule:* event must sit between start:core and complete:core
    const startIdx = events.indexOf('start:core');
    const completeIdx = events.indexOf('complete:core');
    for (let i = 0; i < events.length; i++) {
      if (events[i].startsWith('rule:')) {
        expect(i).toBeGreaterThan(startIdx);
        expect(i).toBeLessThan(completeIdx);
      }
    }
  });

  it('does not carry cross-page state between audits in the same process', async () => {
    // Two different sites that happen to share a title. Rules like
    // core-title-unique accumulate module-level state as pages stream through;
    // without a reset between runs the second audit compares its pages against
    // the first one's and reports a phantom duplicate.
    const SITE_A = 'https://site-a.test/';
    const SITE_B = 'https://site-b.test/';
    const sharedTitleHtml = (url: string) => `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Shared Title</title>
  <meta name="description" content="Two unrelated sites that happen to share a title tag.">
  <link rel="canonical" href="${url}">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body><h1>Shared Title</h1><p>Body content.</p></body>
</html>`;

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url === SITE_A || url === SITE_B) {
          return new Response(sharedTitleHtml(url), {
            status: 200,
            headers: { 'content-type': 'text/html; charset=utf-8' },
          });
        }
        return new Response('', { status: 404 });
      })
    );

    const titleUniqueOf = (result: Awaited<ReturnType<Auditor['audit']>>) =>
      result.categoryResults[0].results.find((r) => r.ruleId === 'core-title-unique');

    const auditorA = createAuditor({ categories: ['core'], measureCwv: false });
    const first = titleUniqueOf(await auditorA.audit(SITE_A));
    expect(first?.status).toBe('pass');

    // A fresh Auditor instance is not enough — the registries are module-level.
    const auditorB = createAuditor({ categories: ['core'], measureCwv: false });
    const second = titleUniqueOf(await auditorB.audit(SITE_B));
    expect(second?.status).toBe('pass');
    expect(second?.message).not.toMatch(/duplicate/i);
  });

  it('issues exactly one HTTP fetch for the audited URL', async () => {
    const auditor = createAuditor({ categories: ['core'], measureCwv: false });
    await auditor.audit(PAGE_URL);

    const pageFetches = fetchStub.mock.calls.filter(([input]) => {
      const url = typeof input === 'string' ? input : (input as URL | Request).toString();
      return url === PAGE_URL;
    });
    expect(pageFetches).toHaveLength(1);
  });
});

describe('markSitemapDiscoverySources', () => {
  function makeSite(normalize: (url: string) => string = (u) => u): SiteContext {
    return {
      entryUrl: 'https://example.com/',
      pageCount: 1,
      depthByUrl: new Map(),
      inboundLinksByUrl: new Map(),
      outboundLinksByUrl: new Map(),
      normalize,
    };
  }

  function makeSitemap(urls: string[]): SitemapFetchResult {
    return { urls, entries: [], sources: [], isIndex: false, skippedSitemaps: 0 };
  }

  it('marks every sitemap URL as sitemap-discovered', () => {
    const site = makeSite();
    markSitemapDiscoverySources(site, makeSitemap([
      'https://example.com/a',
      'https://example.com/b',
    ]));

    const sources = site.discoverySourceByUrl!;
    expect([...sources.get('https://example.com/a')!]).toEqual(['sitemap']);
    expect(sources.get('https://example.com/b')!.has('sitemap')).toBe(true);
  });

  it('accumulates with sources the crawler already recorded', () => {
    const site = makeSite();
    site.discoverySourceByUrl = new Map([['https://example.com/a', new Set(['link' as const])]]);

    markSitemapDiscoverySources(site, makeSitemap(['https://example.com/a']));

    const sources = site.discoverySourceByUrl.get('https://example.com/a')!;
    expect(sources.has('link')).toBe(true);
    expect(sources.has('sitemap')).toBe(true);
  });

  it('keys entries through the site normaliser', () => {
    const site = makeSite((u) => u.replace(/\/$/, ''));
    markSitemapDiscoverySources(site, makeSitemap(['https://example.com/a/']));

    expect(site.discoverySourceByUrl!.has('https://example.com/a')).toBe(true);
    expect(site.discoverySourceByUrl!.has('https://example.com/a/')).toBe(false);
  });

  it('leaves the map untouched when the sitemap has no URLs', () => {
    const site = makeSite();
    markSitemapDiscoverySources(site, makeSitemap([]));

    expect(site.discoverySourceByUrl).toBeUndefined();
  });
});
