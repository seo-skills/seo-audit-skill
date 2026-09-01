import { describe, it, expect } from 'vitest';
import { canonicalToNoindexRule } from './canonical-to-noindex.js';
import { canonicalToDisallowedRule } from './canonical-to-disallowed.js';
import { hreflangToNoindexRule } from './hreflang-to-noindex.js';
import { hreflangToDisallowedRule } from './hreflang-to-disallowed.js';
import { hreflangDisallowedTargetRule } from './hreflang-disallowed-target.js';
import { paginationIsolatedRule } from './pagination-isolated.js';
import { canonicalChainRule } from './canonical-chain.js';
import { canonicalLoopRule } from './canonical-loop.js';
import { createTestContext } from '../test-context.js';
import type { AuditContext, SiteContext, SitePageInfo } from '../../types.js';

/**
 * Build a SiteContext with per-page crawl records.
 *
 * @param entry - Crawl entry URL
 * @param pages - URL → partial crawl record (defaults: 200, indexable, allowed)
 * @param inbound - URL → URLs that link to it
 */
function makeSite(
  entry: string,
  pages: Record<string, Partial<SitePageInfo>>,
  inbound: Record<string, string[]> = {}
): SiteContext {
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
  };
}

const HOME = 'https://example.com/';
const PAGE_A = 'https://example.com/a';
const PAGE_B = 'https://example.com/b';
const PAGE_C = 'https://example.com/c';

function pageIn(url: string, site: SiteContext, html = '<html><body></body></html>'): AuditContext {
  return createTestContext(html, { url, site });
}

describe('canonicalToNoindexRule', () => {
  it('reports unmeasured without crawl state', async () => {
    const result = await canonicalToNoindexRule.run(createTestContext('<html></html>', { url: PAGE_A }));
    expect(result.weight).toBe(0);
  });

  it('fails when the canonical target is noindex', async () => {
    const site = makeSite(HOME, {
      [PAGE_A]: { canonical: PAGE_B },
      [PAGE_B]: { noindex: true },
    });
    const result = await canonicalToNoindexRule.run(pageIn(PAGE_A, site));
    expect(result.status).toBe('fail');
    expect(result.details?.canonical).toBe(PAGE_B);
  });

  it('passes when the canonical target is indexable', async () => {
    const site = makeSite(HOME, {
      [PAGE_A]: { canonical: PAGE_B },
      [PAGE_B]: {},
    });
    const result = await canonicalToNoindexRule.run(pageIn(PAGE_A, site));
    expect(result.status).toBe('pass');
  });

  it('passes on a self-referencing canonical even when the page is noindex', async () => {
    const site = makeSite(HOME, {
      [PAGE_A]: { canonical: PAGE_A, noindex: true },
    });
    const result = await canonicalToNoindexRule.run(pageIn(PAGE_A, site));
    expect(result.status).toBe('pass');
  });

  it('passes when no canonical is declared', async () => {
    const site = makeSite(HOME, { [PAGE_A]: {} });
    const result = await canonicalToNoindexRule.run(pageIn(PAGE_A, site));
    expect(result.status).toBe('pass');
  });

  it('reports unmeasured when the canonical target was not crawled', async () => {
    const site = makeSite(HOME, {
      [PAGE_A]: { canonical: 'https://example.com/uncrawled' },
    });
    const result = await canonicalToNoindexRule.run(pageIn(PAGE_A, site));
    expect(result.weight).toBe(0);
  });

  it('falls back to parsing the canonical tag when the page has no crawl record', async () => {
    const site = makeSite(HOME, {
      [PAGE_B]: { noindex: true },
    });
    const html = `<html><head><link rel="canonical" href="${PAGE_B}"></head></html>`;
    const result = await canonicalToNoindexRule.run(pageIn(PAGE_A, site, html));
    expect(result.status).toBe('fail');
  });
});

describe('canonicalToDisallowedRule', () => {
  it('reports unmeasured without crawl state', async () => {
    const result = await canonicalToDisallowedRule.run(createTestContext('<html></html>', { url: PAGE_A }));
    expect(result.weight).toBe(0);
  });

  it('fails when the canonical target is disallowed by robots.txt', async () => {
    const site = makeSite(HOME, {
      [PAGE_A]: { canonical: PAGE_B },
      [PAGE_B]: { disallowed: true },
    });
    const result = await canonicalToDisallowedRule.run(pageIn(PAGE_A, site));
    expect(result.status).toBe('fail');
    expect(result.details?.canonical).toBe(PAGE_B);
  });

  it('passes when the canonical target is crawlable', async () => {
    const site = makeSite(HOME, {
      [PAGE_A]: { canonical: PAGE_B },
      [PAGE_B]: {},
    });
    const result = await canonicalToDisallowedRule.run(pageIn(PAGE_A, site));
    expect(result.status).toBe('pass');
  });

  it('reports unmeasured when the canonical target was not crawled', async () => {
    const site = makeSite(HOME, {
      [PAGE_A]: { canonical: 'https://example.com/uncrawled' },
    });
    const result = await canonicalToDisallowedRule.run(pageIn(PAGE_A, site));
    expect(result.weight).toBe(0);
  });
});

describe('hreflangToNoindexRule', () => {
  it('reports unmeasured without crawl state', async () => {
    const result = await hreflangToNoindexRule.run(createTestContext('<html></html>', { url: PAGE_A }));
    expect(result.weight).toBe(0);
  });

  it('passes when the page has no hreflang annotations', async () => {
    const site = makeSite(HOME, { [PAGE_A]: {} });
    const result = await hreflangToNoindexRule.run(pageIn(PAGE_A, site));
    expect(result.status).toBe('pass');
  });

  it('fails when an hreflang target is noindex', async () => {
    const site = makeSite(HOME, {
      [PAGE_A]: { hreflangOut: { fr: PAGE_B, de: PAGE_C } },
      [PAGE_B]: { noindex: true },
      [PAGE_C]: {},
    });
    const result = await hreflangToNoindexRule.run(pageIn(PAGE_A, site));
    expect(result.status).toBe('fail');
    expect(result.details?.flagged).toEqual([{ code: 'fr', url: PAGE_B }]);
  });

  it('passes when all crawled hreflang targets are indexable', async () => {
    const site = makeSite(HOME, {
      [PAGE_A]: { hreflangOut: { fr: PAGE_B } },
      [PAGE_B]: {},
    });
    const result = await hreflangToNoindexRule.run(pageIn(PAGE_A, site));
    expect(result.status).toBe('pass');
  });

  it('reports unmeasured when no hreflang target was crawled', async () => {
    const site = makeSite(HOME, {
      [PAGE_A]: { hreflangOut: { fr: 'https://example.com/uncrawled' } },
    });
    const result = await hreflangToNoindexRule.run(pageIn(PAGE_A, site));
    expect(result.weight).toBe(0);
  });

  it('falls back to parsing hreflang tags when the page has no crawl record', async () => {
    const site = makeSite(HOME, {
      [PAGE_B]: { noindex: true },
    });
    const html = `<html><head><link rel="alternate" hreflang="fr" href="${PAGE_B}"></head></html>`;
    const result = await hreflangToNoindexRule.run(pageIn(PAGE_A, site, html));
    expect(result.status).toBe('fail');
  });
});

describe('hreflangToDisallowedRule', () => {
  it('reports unmeasured without crawl state', async () => {
    const result = await hreflangToDisallowedRule.run(createTestContext('<html></html>', { url: PAGE_A }));
    expect(result.weight).toBe(0);
  });

  it('fails when an hreflang target is disallowed by robots.txt', async () => {
    const site = makeSite(HOME, {
      [PAGE_A]: { hreflangOut: { fr: PAGE_B } },
      [PAGE_B]: { disallowed: true },
    });
    const result = await hreflangToDisallowedRule.run(pageIn(PAGE_A, site));
    expect(result.status).toBe('fail');
    expect(result.details?.flagged).toEqual([{ code: 'fr', url: PAGE_B }]);
  });

  it('passes when hreflang targets are crawlable', async () => {
    const site = makeSite(HOME, {
      [PAGE_A]: { hreflangOut: { fr: PAGE_B } },
      [PAGE_B]: {},
    });
    const result = await hreflangToDisallowedRule.run(pageIn(PAGE_A, site));
    expect(result.status).toBe('pass');
  });
});

describe('hreflangDisallowedTargetRule', () => {
  it('reports unmeasured without crawl state', async () => {
    const result = await hreflangDisallowedTargetRule.run(createTestContext('<html></html>', { url: PAGE_A }));
    expect(result.weight).toBe(0);
  });

  it('reports unmeasured when the page has no crawl record', async () => {
    const site = makeSite(HOME, { [PAGE_B]: {} });
    const result = await hreflangDisallowedTargetRule.run(pageIn(PAGE_A, site));
    expect(result.weight).toBe(0);
  });

  it('passes when the page is not disallowed', async () => {
    const site = makeSite(HOME, {
      [PAGE_A]: {},
      [PAGE_B]: { hreflangOut: { en: PAGE_A } },
    });
    const result = await hreflangDisallowedTargetRule.run(pageIn(PAGE_A, site));
    expect(result.status).toBe('pass');
  });

  it('fails when a disallowed page receives hreflang from another page', async () => {
    const site = makeSite(HOME, {
      [PAGE_A]: { disallowed: true },
      [PAGE_B]: { hreflangOut: { en: PAGE_A } },
      [PAGE_C]: { hreflangOut: { 'x-default': PAGE_A } },
    });
    const result = await hreflangDisallowedTargetRule.run(pageIn(PAGE_A, site));
    expect(result.status).toBe('fail');
    expect(result.details?.referringCount).toBe(2);
  });

  it('passes when a disallowed page receives no incoming hreflang', async () => {
    const site = makeSite(HOME, {
      [PAGE_A]: { disallowed: true },
      [PAGE_B]: { hreflangOut: { fr: PAGE_C } },
      [PAGE_C]: {},
    });
    const result = await hreflangDisallowedTargetRule.run(pageIn(PAGE_A, site));
    expect(result.status).toBe('pass');
  });

  it('ignores the page’s own self-referencing hreflang', async () => {
    const site = makeSite(HOME, {
      [PAGE_A]: { disallowed: true, hreflangOut: { en: PAGE_A } },
    });
    const result = await hreflangDisallowedTargetRule.run(pageIn(PAGE_A, site));
    expect(result.status).toBe('pass');
  });
});

describe('paginationIsolatedRule', () => {
  it('reports unmeasured without crawl state', async () => {
    const result = await paginationIsolatedRule.run(createTestContext('<html></html>', { url: PAGE_A }));
    expect(result.weight).toBe(0);
  });

  it('passes a non-paginated page', async () => {
    const site = makeSite(HOME, { [PAGE_A]: {} });
    const result = await paginationIsolatedRule.run(pageIn(PAGE_A, site));
    expect(result.status).toBe('pass');
  });

  it('fails a paginated URL with no incoming internal links', async () => {
    const page2 = 'https://example.com/blog?page=2';
    const site = makeSite(HOME, { [page2]: {} });
    const result = await paginationIsolatedRule.run(pageIn(page2, site));
    expect(result.status).toBe('fail');
    expect(result.details?.inboundLinkCount).toBe(0);
  });

  it('fails a /page/N URL with no incoming internal links', async () => {
    const page2 = 'https://example.com/blog/page/2';
    const site = makeSite(HOME, { [page2]: {} });
    const result = await paginationIsolatedRule.run(pageIn(page2, site));
    expect(result.status).toBe('fail');
  });

  it('passes a paginated URL with incoming links', async () => {
    const page2 = 'https://example.com/blog?page=2';
    const site = makeSite(HOME, { [HOME]: {}, [page2]: {} }, { [page2]: [HOME] });
    const result = await paginationIsolatedRule.run(pageIn(page2, site));
    expect(result.status).toBe('pass');
    expect(result.details?.inboundLinkCount).toBe(1);
  });

  it('treats rel="prev" as a pagination signal', async () => {
    const html = '<html><head><link rel="prev" href="https://example.com/blog"></head></html>';
    const site = makeSite(HOME, { [PAGE_A]: {} });
    const result = await paginationIsolatedRule.run(pageIn(PAGE_A, site, html));
    expect(result.status).toBe('fail');
  });

  it('does not fail the crawl entry point', async () => {
    const entry = 'https://example.com/blog/page/1';
    const site = makeSite(entry, { [entry]: {} });
    const result = await paginationIsolatedRule.run(pageIn(entry, site));
    expect(result.status).toBe('pass');
  });
});

describe('canonicalChainRule', () => {
  it('reports unmeasured without crawl state', async () => {
    const result = await canonicalChainRule.run(createTestContext('<html></html>', { url: PAGE_A }));
    expect(result.weight).toBe(0);
  });

  it('warns when the canonical target is itself canonicalized elsewhere', async () => {
    const site = makeSite(HOME, {
      [PAGE_A]: { canonical: PAGE_B },
      [PAGE_B]: { canonical: PAGE_C },
      [PAGE_C]: { canonical: PAGE_C },
    });
    const result = await canonicalChainRule.run(pageIn(PAGE_A, site));
    expect(result.status).toBe('warn');
    expect(result.details?.targetCanonical).toBe(PAGE_C);
  });

  it('passes when the canonical target is a final destination', async () => {
    const site = makeSite(HOME, {
      [PAGE_A]: { canonical: PAGE_B },
      [PAGE_B]: { canonical: PAGE_B },
    });
    const result = await canonicalChainRule.run(pageIn(PAGE_A, site));
    expect(result.status).toBe('pass');
  });

  it('passes a self-referencing canonical', async () => {
    const site = makeSite(HOME, { [PAGE_A]: { canonical: PAGE_A } });
    const result = await canonicalChainRule.run(pageIn(PAGE_A, site));
    expect(result.status).toBe('pass');
  });

  it('defers to crawl-canonical-loop when the chain loops', async () => {
    const site = makeSite(HOME, {
      [PAGE_A]: { canonical: PAGE_B },
      [PAGE_B]: { canonical: PAGE_A },
    });
    const result = await canonicalChainRule.run(pageIn(PAGE_A, site));
    expect(result.status).toBe('pass');
  });

  it('reports unmeasured when the chain leaves the crawled set', async () => {
    const site = makeSite(HOME, {
      [PAGE_A]: { canonical: 'https://example.com/uncrawled' },
    });
    const result = await canonicalChainRule.run(pageIn(PAGE_A, site));
    expect(result.weight).toBe(0);
  });
});

describe('canonicalLoopRule', () => {
  it('reports unmeasured without crawl state', async () => {
    const result = await canonicalLoopRule.run(createTestContext('<html></html>', { url: PAGE_A }));
    expect(result.weight).toBe(0);
  });

  it('fails when canonicals loop back to this page', async () => {
    const site = makeSite(HOME, {
      [PAGE_A]: { canonical: PAGE_B },
      [PAGE_B]: { canonical: PAGE_A },
    });
    const result = await canonicalLoopRule.run(pageIn(PAGE_A, site));
    expect(result.status).toBe('fail');
    expect(result.details?.path).toEqual([PAGE_A, PAGE_B, PAGE_A]);
  });

  it('fails on a loop further down the chain', async () => {
    const site = makeSite(HOME, {
      [PAGE_A]: { canonical: PAGE_B },
      [PAGE_B]: { canonical: PAGE_C },
      [PAGE_C]: { canonical: PAGE_B },
    });
    const result = await canonicalLoopRule.run(pageIn(PAGE_A, site));
    expect(result.status).toBe('fail');
  });

  it('passes a chain that resolves to a final destination', async () => {
    const site = makeSite(HOME, {
      [PAGE_A]: { canonical: PAGE_B },
      [PAGE_B]: { canonical: PAGE_C },
      [PAGE_C]: { canonical: PAGE_C },
    });
    const result = await canonicalLoopRule.run(pageIn(PAGE_A, site));
    expect(result.status).toBe('pass');
  });

  it('passes a self-referencing canonical', async () => {
    const site = makeSite(HOME, { [PAGE_A]: { canonical: PAGE_A } });
    const result = await canonicalLoopRule.run(pageIn(PAGE_A, site));
    expect(result.status).toBe('pass');
  });

  it('reports unmeasured when the chain leaves the crawled set', async () => {
    const site = makeSite(HOME, {
      [PAGE_A]: { canonical: PAGE_B },
      [PAGE_B]: { canonical: 'https://example.com/uncrawled' },
    });
    const result = await canonicalLoopRule.run(pageIn(PAGE_A, site));
    expect(result.weight).toBe(0);
  });
});
