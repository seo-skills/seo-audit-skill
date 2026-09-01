import { describe, it, expect } from 'vitest';
import { crawlIsolatedUrlRule } from './isolated-url.js';
import { createTestContext } from '../test-context.js';
import type { AuditContext, DiscoverySource, SiteContext, SitePageInfo } from '../../types.js';

/**
 * Build a SiteContext with per-URL discovery records and a link graph.
 *
 * @param entry - Crawl entry URL
 * @param discovery - URL → discovery sources (link/canonical/redirect/sitemap/entry)
 * @param pages - URL → partial crawl record (defaults: 200, indexable, allowed)
 * @param inbound - URL → URLs that link to it
 */
function makeSite(
  entry: string,
  discovery: Record<string, DiscoverySource[]>,
  pages: Record<string, Partial<SitePageInfo>> = {},
  inbound: Record<string, string[]> = {}
): SiteContext {
  const discoverySourceByUrl = new Map<string, Set<DiscoverySource>>();
  for (const [url, sources] of Object.entries(discovery)) {
    discoverySourceByUrl.set(url, new Set(sources));
  }
  const pagesMap = new Map<string, SitePageInfo>();
  for (const [url, p] of Object.entries(pages)) {
    pagesMap.set(url, {
      statusCode: 200,
      noindex: false,
      nofollow: false,
      disallowed: false,
      hreflangOut: {},
      ...p,
    });
  }
  const inboundLinksByUrl = new Map<string, Set<string>>();
  for (const [to, froms] of Object.entries(inbound)) {
    inboundLinksByUrl.set(to, new Set(froms));
  }
  return {
    entryUrl: entry,
    pageCount: pagesMap.size,
    depthByUrl: new Map(),
    inboundLinksByUrl,
    outboundLinksByUrl: new Map(),
    // Identity normalisation keeps the fixtures readable.
    normalize: (u: string) => u,
    pages: pagesMap,
    discoverySourceByUrl,
  };
}

const HOME = 'https://example.com/';
const PAGE_A = 'https://example.com/a';
const PAGE_B = 'https://example.com/b';
const PAGE_C = 'https://example.com/c';
const PAGE_D = 'https://example.com/d';

function pageIn(url: string, site: SiteContext): AuditContext {
  return createTestContext('<html><body></body></html>', { url, site });
}

describe('crawlIsolatedUrlRule', () => {
  it('reports unmeasured without a site context', async () => {
    const result = await crawlIsolatedUrlRule.run(
      createTestContext('<html></html>', { url: PAGE_A })
    );
    expect(result.weight).toBe(0);
  });

  it('reports unmeasured when the site carries no discovery records', async () => {
    const site = makeSite(HOME, { [HOME]: ['entry'] });
    delete site.discoverySourceByUrl;
    const result = await crawlIsolatedUrlRule.run(pageIn(PAGE_A, site));
    expect(result.weight).toBe(0);
  });

  it('reports unmeasured when the URL has no discovery record', async () => {
    const site = makeSite(HOME, { [HOME]: ['entry'] });
    const result = await crawlIsolatedUrlRule.run(pageIn(PAGE_A, site));
    expect(result.weight).toBe(0);
  });

  it('passes for the crawl entry point', async () => {
    const site = makeSite(HOME, { [HOME]: ['entry'] });
    const result = await crawlIsolatedUrlRule.run(pageIn(HOME, site));
    expect(result.status).toBe('pass');
  });

  it('passes for a normally linked page', async () => {
    const site = makeSite(
      HOME,
      { [HOME]: ['entry'], [PAGE_A]: ['link'] },
      { [PAGE_A]: {} },
      { [PAGE_A]: [HOME] }
    );
    const result = await crawlIsolatedUrlRule.run(pageIn(PAGE_A, site));
    expect(result.status).toBe('pass');
  });

  it('fails when the URL is only found via a canonical', async () => {
    const site = makeSite(HOME, { [HOME]: ['entry'], [PAGE_A]: ['canonical'] });
    const result = await crawlIsolatedUrlRule.run(pageIn(PAGE_A, site));
    expect(result.status).toBe('fail');
    expect(result.message).toContain('canonical');
    expect(result.details?.isolationKind).toBe('no-inbound-links');
  });

  it('fails when the URL is only found via a redirect', async () => {
    const site = makeSite(HOME, { [HOME]: ['entry'], [PAGE_A]: ['redirect'] });
    const result = await crawlIsolatedUrlRule.run(pageIn(PAGE_A, site));
    expect(result.status).toBe('fail');
    expect(result.message).toContain('redirect');
  });

  it('fails when the URL is only found in the sitemap', async () => {
    const site = makeSite(HOME, { [HOME]: ['entry'], [PAGE_A]: ['sitemap'] });
    const result = await crawlIsolatedUrlRule.run(pageIn(PAGE_A, site));
    expect(result.status).toBe('fail');
    expect(result.message).toContain('sitemap');
  });

  it('reports every non-link source the URL was found via', async () => {
    const site = makeSite(HOME, {
      [HOME]: ['entry'],
      [PAGE_A]: ['canonical', 'redirect'],
    });
    const result = await crawlIsolatedUrlRule.run(pageIn(PAGE_A, site));
    expect(result.status).toBe('fail');
    expect(result.message).toContain('canonical');
    expect(result.message).toContain('redirect');
  });

  it('fails when the URL is only reachable through noindex,follow pages', async () => {
    const site = makeSite(
      HOME,
      { [HOME]: ['entry'], [PAGE_A]: ['link'], [PAGE_B]: ['link'] },
      { [PAGE_B]: { noindex: true, nofollow: false } },
      { [PAGE_A]: [PAGE_B], [PAGE_B]: [HOME] }
    );
    const result = await crawlIsolatedUrlRule.run(pageIn(PAGE_A, site));
    expect(result.status).toBe('fail');
    expect(result.details?.isolationKind).toBe('noindex-follow-only');
  });

  it('passes when at least one linking page is indexable', async () => {
    const site = makeSite(
      HOME,
      { [HOME]: ['entry'], [PAGE_A]: ['link'], [PAGE_B]: ['link'], [PAGE_C]: ['link'] },
      { [PAGE_B]: { noindex: true }, [PAGE_C]: {} },
      { [PAGE_A]: [PAGE_B, PAGE_C], [PAGE_B]: [HOME], [PAGE_C]: [HOME] }
    );
    const result = await crawlIsolatedUrlRule.run(pageIn(PAGE_A, site));
    expect(result.status).toBe('pass');
  });

  it('passes when a noindex,follow linker was not crawled', async () => {
    // The linker's robots state is unknown, so there is no verdict.
    const site = makeSite(
      HOME,
      { [HOME]: ['entry'], [PAGE_A]: ['link'] },
      {},
      { [PAGE_A]: ['https://example.com/uncrawled'] }
    );
    const result = await crawlIsolatedUrlRule.run(pageIn(PAGE_A, site));
    expect(result.status).toBe('pass');
  });

  it('fails when the URL is only linked from other isolated URLs', async () => {
    const site = makeSite(
      HOME,
      { [HOME]: ['entry'], [PAGE_A]: ['link'], [PAGE_B]: ['sitemap'] },
      { [PAGE_A]: {}, [PAGE_B]: {} },
      { [PAGE_A]: [PAGE_B] }
    );
    const result = await crawlIsolatedUrlRule.run(pageIn(PAGE_A, site));
    expect(result.status).toBe('fail');
    expect(result.details?.isolationKind).toBe('isolated-linkers-only');
  });

  it('propagates isolation one pass: linked from a page linked only from isolated pages', async () => {
    const site = makeSite(
      HOME,
      {
        [HOME]: ['entry'],
        [PAGE_A]: ['link'],
        [PAGE_B]: ['link'],
        [PAGE_C]: ['sitemap'],
      },
      { [PAGE_A]: {}, [PAGE_B]: {}, [PAGE_C]: {} },
      { [PAGE_A]: [PAGE_B], [PAGE_B]: [PAGE_C] }
    );
    const result = await crawlIsolatedUrlRule.run(pageIn(PAGE_A, site));
    expect(result.status).toBe('fail');
    expect(result.details?.isolationKind).toBe('isolated-linkers-only');
  });

  it('passes when linked from a mix of isolated and normally-linked pages', async () => {
    const site = makeSite(
      HOME,
      {
        [HOME]: ['entry'],
        [PAGE_A]: ['link'],
        [PAGE_B]: ['sitemap'],
        [PAGE_C]: ['link'],
      },
      { [PAGE_A]: {}, [PAGE_B]: {}, [PAGE_C]: {} },
      { [PAGE_A]: [PAGE_B, PAGE_C], [PAGE_C]: [HOME] }
    );
    const result = await crawlIsolatedUrlRule.run(pageIn(PAGE_A, site));
    expect(result.status).toBe('pass');
  });

  it('reports unmeasured when discovery shows a link but the graph has no inbound edge', async () => {
    const site = makeSite(HOME, { [HOME]: ['entry'], [PAGE_A]: ['link'] });
    const result = await crawlIsolatedUrlRule.run(pageIn(PAGE_A, site));
    expect(result.weight).toBe(0);
  });
});
