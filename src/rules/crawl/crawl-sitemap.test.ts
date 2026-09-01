import { describe, it, expect } from 'vitest';
import { sitemapNon200Rule } from './sitemap-non-200.js';
import { sitemapNonCanonicalRule } from './sitemap-non-canonical.js';
import { sitemapDisallowedRule } from './sitemap-disallowed.js';
import { sitemapCrossDuplicatesRule } from './sitemap-cross-duplicates.js';
import { createTestContext } from '../test-context.js';
import type { AuditContext, SiteContext, SitePageInfo } from '../../types.js';

/**
 * URL normalisation matching the crawler's contract: lowercase host, strip a
 * trailing slash from non-root paths, keep the query string.
 */
function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    let path = u.pathname;
    if (path.length > 1 && path.endsWith('/')) {
      path = path.slice(0, -1);
    }
    return `${u.protocol}//${u.host.toLowerCase()}${path}${u.search}`;
  } catch {
    return url.toLowerCase().replace(/\/$/, '');
  }
}

/**
 * Build a SiteContext whose `pages` map covers the given URLs.
 *
 * @param pages - URL → partial SitePageInfo; missing fields get crawl-success
 *   defaults (200, indexable, allowed, no hreflang)
 */
function makeSite(pages: Record<string, Partial<SitePageInfo>>): SiteContext {
  const pageMap = new Map<string, SitePageInfo>();
  for (const [url, info] of Object.entries(pages)) {
    pageMap.set(normalizeUrl(url), {
      statusCode: 200,
      noindex: false,
      nofollow: false,
      disallowed: false,
      hreflangOut: {},
      ...info,
    });
  }
  return {
    entryUrl: normalizeUrl('https://example.com/'),
    pageCount: pageMap.size,
    depthByUrl: new Map(),
    inboundLinksByUrl: new Map(),
    outboundLinksByUrl: new Map(),
    normalize: normalizeUrl,
    pages: pageMap,
  };
}

const OK = 'https://example.com/ok';
const GONE = 'https://example.com/gone';
const BOOM = 'https://example.com/boom';
const MOVED = 'https://example.com/moved';
const SLOW = 'https://example.com/slow';
const HIDDEN = 'https://example.com/hidden';

function ctx(overrides: Partial<AuditContext>): AuditContext {
  return createTestContext('<html><body></body></html>', overrides);
}

describe('sitemapNon200Rule', () => {
  const sitemapUrls = [OK, GONE, BOOM, MOVED, SLOW];

  it('reports unmeasured without a crawl (no site graph)', async () => {
    const result = await sitemapNon200Rule.run(ctx({ sitemapUrls }));
    expect(result.weight).toBe(0);
  });

  it('reports unmeasured when the crawl recorded no per-page data', async () => {
    const site = makeSite({});
    delete site.pages;
    const result = await sitemapNon200Rule.run(ctx({ site, sitemapUrls }));
    expect(result.weight).toBe(0);
  });

  it('reports unmeasured when there are no sitemap URLs', async () => {
    const site = makeSite({ [OK]: {} });
    const result = await sitemapNon200Rule.run(ctx({ site }));
    expect(result.weight).toBe(0);
  });

  it('fails on 4xx and 5xx sitemap URLs', async () => {
    const site = makeSite({
      [OK]: {},
      [GONE]: { statusCode: 404 },
      [BOOM]: { statusCode: 500 },
    });
    const result = await sitemapNon200Rule.run(ctx({ site, sitemapUrls: [OK, GONE, BOOM] }));
    expect(result.status).toBe('fail');
    expect(result.details?.clientErrorCount).toBe(1);
    expect(result.details?.serverErrorCount).toBe(1);
  });

  it('counts 403s among the 4xx failures', async () => {
    const site = makeSite({ [HIDDEN]: { statusCode: 403 } });
    const result = await sitemapNon200Rule.run(ctx({ site, sitemapUrls: [HIDDEN] }));
    expect(result.status).toBe('fail');
    expect(result.details?.forbiddenCount).toBe(1);
  });

  it('warns on redirected and timed-out sitemap URLs', async () => {
    const site = makeSite({
      [OK]: {},
      [MOVED]: { statusCode: 301 },
      [SLOW]: { statusCode: 0 },
    });
    const result = await sitemapNon200Rule.run(ctx({ site, sitemapUrls: [OK, MOVED, SLOW] }));
    expect(result.status).toBe('warn');
    expect(result.details?.redirectCount).toBe(1);
    expect(result.details?.timedOutCount).toBe(1);
  });

  it('passes when every crawled sitemap URL returns 2xx', async () => {
    const site = makeSite({ [OK]: {}, [MOVED]: { statusCode: 200 } });
    const result = await sitemapNon200Rule.run(ctx({ site, sitemapUrls: [OK, MOVED] }));
    expect(result.status).toBe('pass');
  });

  it('ignores sitemap URLs the crawl never reached', async () => {
    const site = makeSite({ [OK]: {} });
    const result = await sitemapNon200Rule.run(
      ctx({ site, sitemapUrls: [OK, 'https://example.com/never-crawled'] })
    );
    expect(result.status).toBe('pass');
    expect(result.details?.notCrawledCount).toBe(1);
    expect(result.details?.checkedCount).toBe(1);
  });
});

describe('sitemapNonCanonicalRule', () => {
  const ALIAS = 'https://example.com/alias';
  const TARGET = 'https://example.com/target';

  it('reports unmeasured without a crawl', async () => {
    const result = await sitemapNonCanonicalRule.run(ctx({ sitemapUrls: [OK] }));
    expect(result.weight).toBe(0);
  });

  it('reports unmeasured when there are no sitemap URLs', async () => {
    const site = makeSite({ [OK]: {} });
    const result = await sitemapNonCanonicalRule.run(ctx({ site }));
    expect(result.weight).toBe(0);
  });

  it('fails when a sitemap URL canonicalises to a different URL', async () => {
    const site = makeSite({
      [ALIAS]: { canonical: TARGET },
      [TARGET]: { canonical: TARGET },
    });
    const result = await sitemapNonCanonicalRule.run(
      ctx({ site, sitemapUrls: [ALIAS, TARGET] })
    );
    expect(result.status).toBe('fail');
    expect(result.details?.canonicalisedCount).toBe(1);
    expect(result.details?.canonicalisedUrls).toEqual([{ url: ALIAS, canonical: TARGET }]);
  });

  it('passes on self-referential canonicals, ignoring cosmetic differences', async () => {
    const site = makeSite({ [OK]: { canonical: `${OK}/` } });
    const result = await sitemapNonCanonicalRule.run(ctx({ site, sitemapUrls: [OK] }));
    expect(result.status).toBe('pass');
  });

  it('passes when sitemap URLs declare no canonical', async () => {
    const site = makeSite({ [OK]: {} });
    const result = await sitemapNonCanonicalRule.run(ctx({ site, sitemapUrls: [OK] }));
    expect(result.status).toBe('pass');
  });

  it('skips unresolvable (null) canonicals and uncrawled URLs', async () => {
    const site = makeSite({ [OK]: { canonical: null } });
    const result = await sitemapNonCanonicalRule.run(
      ctx({ site, sitemapUrls: [OK, 'https://example.com/never-crawled'] })
    );
    expect(result.status).toBe('pass');
    expect(result.details?.notCrawledCount).toBe(1);
  });
});

describe('sitemapDisallowedRule', () => {
  it('reports unmeasured without a crawl', async () => {
    const result = await sitemapDisallowedRule.run(ctx({ sitemapUrls: [OK] }));
    expect(result.weight).toBe(0);
  });

  it('reports unmeasured when there are no sitemap URLs', async () => {
    const site = makeSite({ [OK]: {} });
    const result = await sitemapDisallowedRule.run(ctx({ site }));
    expect(result.weight).toBe(0);
  });

  it('fails when a sitemap URL is disallowed by robots.txt', async () => {
    const site = makeSite({ [OK]: {}, [HIDDEN]: { disallowed: true } });
    const result = await sitemapDisallowedRule.run(
      ctx({ site, sitemapUrls: [OK, HIDDEN], robotsTxtContent: 'User-agent: *\nDisallow: /hidden' })
    );
    expect(result.status).toBe('fail');
    expect(result.details?.disallowedUrls).toEqual([HIDDEN]);
  });

  it('reports unmeasured when nothing is disallowed and robots.txt was never fetched', async () => {
    const site = makeSite({ [OK]: {} });
    const result = await sitemapDisallowedRule.run(ctx({ site, sitemapUrls: [OK] }));
    expect(result.weight).toBe(0);
  });

  it('passes when robots.txt was fetched and nothing in the sitemap is disallowed', async () => {
    const site = makeSite({ [OK]: {} });
    const result = await sitemapDisallowedRule.run(
      ctx({ site, sitemapUrls: [OK], robotsTxtContent: 'User-agent: *\nAllow: /' })
    );
    expect(result.status).toBe('pass');
  });

  it('passes when robots.txt was evaluated (other pages disallowed) but no sitemap URL is', async () => {
    const site = makeSite({ [OK]: {}, [HIDDEN]: { disallowed: true } });
    const result = await sitemapDisallowedRule.run(ctx({ site, sitemapUrls: [OK] }));
    expect(result.status).toBe('pass');
  });
});

describe('sitemapCrossDuplicatesRule', () => {
  const SITEMAP_A = 'https://example.com/sitemap-posts.xml';
  const SITEMAP_B = 'https://example.com/sitemap-pages.xml';
  const site = makeSite({ [OK]: {}, [GONE]: {} });

  it('reports unmeasured without a crawl', async () => {
    const result = await sitemapCrossDuplicatesRule.run(ctx({ sitemapUrls: [OK] }));
    expect(result.weight).toBe(0);
  });

  it('reports unmeasured when there are no sitemap URLs', async () => {
    const result = await sitemapCrossDuplicatesRule.run(ctx({ site }));
    expect(result.weight).toBe(0);
  });

  it('reports unmeasured when sitemap document membership was not recorded', async () => {
    const result = await sitemapCrossDuplicatesRule.run(ctx({ site, sitemapUrls: [OK] }));
    expect(result.weight).toBe(0);
  });

  it('warns when a URL is declared by more than one sitemap document', async () => {
    const sitemapUrlSources = new Map<string, string[]>([
      [OK, [SITEMAP_A, SITEMAP_B]],
      [GONE, [SITEMAP_B]],
    ]);
    const result = await sitemapCrossDuplicatesRule.run(
      ctx({ site, sitemapUrls: [OK, GONE], sitemapUrlSources })
    );
    expect(result.status).toBe('warn');
    expect(result.weight).not.toBe(0);
    expect(result.details?.duplicateCount).toBe(1);
    expect(result.details?.duplicateUrls).toEqual([{ url: OK, sitemaps: [SITEMAP_A, SITEMAP_B] }]);
  });

  it('passes when every URL belongs to exactly one sitemap', async () => {
    const sitemapUrlSources = new Map<string, string[]>([
      [OK, [SITEMAP_A]],
      [GONE, [SITEMAP_B]],
    ]);
    const result = await sitemapCrossDuplicatesRule.run(
      ctx({ site, sitemapUrls: [OK, GONE], sitemapUrlSources })
    );
    expect(result.status).toBe('pass');
  });
});
