import { describe, it, expect } from 'vitest';
import { hreflangIncomingConflictRule } from './hreflang-incoming-conflict.js';
import { hreflangReciprocityRule } from './hreflang-reciprocity.js';
import { createTestContext } from '../test-context.js';
import type { AuditContext, SiteContext, SitePageInfo } from '../../types.js';

/**
 * Build a SiteContext with per-page crawl records.
 *
 * @param entry - Crawl entry URL
 * @param pages - URL → partial crawl record (defaults: 200, indexable, allowed)
 */
function makeSite(
  entry: string,
  pages: Record<string, Partial<SitePageInfo>>
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
  return {
    entryUrl: entry,
    pageCount: pagesMap.size,
    depthByUrl: new Map(),
    inboundLinksByUrl: new Map(),
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

describe('hreflangIncomingConflictRule', () => {
  it('reports unmeasured without crawl state', async () => {
    const result = await hreflangIncomingConflictRule.run(
      createTestContext('<html></html>', { url: PAGE_A })
    );
    expect(result.weight).toBe(0);
  });

  it('fails when other pages annotate this URL with different codes', async () => {
    const site = makeSite(HOME, {
      [PAGE_A]: {},
      [PAGE_B]: { hreflangOut: { en: PAGE_A } },
      [PAGE_C]: { hreflangOut: { fr: PAGE_A } },
    });
    const result = await hreflangIncomingConflictRule.run(pageIn(PAGE_A, site));
    expect(result.status).toBe('fail');
    const conflicts = result.details?.conflicts as Array<{ hreflang: string; sources: string[] }>;
    expect(conflicts).toHaveLength(2);
    expect(conflicts.map((c) => c.hreflang).sort()).toEqual(['en', 'fr']);
  });

  it('passes when other pages agree on the code for this URL', async () => {
    const site = makeSite(HOME, {
      [PAGE_A]: {},
      [PAGE_B]: { hreflangOut: { en: PAGE_A, fr: PAGE_C } },
      [PAGE_C]: { hreflangOut: { en: PAGE_A } },
    });
    const result = await hreflangIncomingConflictRule.run(pageIn(PAGE_A, site));
    expect(result.status).toBe('pass');
    expect(result.details?.incomingCodes).toEqual(['en']);
  });

  it('passes when no other page annotates this URL', async () => {
    const site = makeSite(HOME, {
      [PAGE_A]: {},
      [PAGE_B]: { hreflangOut: { en: PAGE_B } },
    });
    const result = await hreflangIncomingConflictRule.run(pageIn(PAGE_A, site));
    expect(result.status).toBe('pass');
    expect(result.details?.incomingCodes).toEqual([]);
  });

  it('does not treat an x-default annotation as a conflicting code', async () => {
    const site = makeSite(HOME, {
      [PAGE_A]: {},
      [PAGE_B]: { hreflangOut: { en: PAGE_A } },
      [PAGE_C]: { hreflangOut: { 'x-default': PAGE_A } },
    });
    const result = await hreflangIncomingConflictRule.run(pageIn(PAGE_A, site));
    expect(result.status).toBe('pass');
  });

  it('ignores the page\'s own annotations - self-conflicts are the outgoing rule\'s job', async () => {
    const site = makeSite(HOME, {
      [PAGE_A]: { hreflangOut: { en: PAGE_A, fr: PAGE_A } },
    });
    const result = await hreflangIncomingConflictRule.run(pageIn(PAGE_A, site));
    expect(result.status).toBe('pass');
    expect(result.details?.incomingCodes).toEqual([]);
  });

  it('does not flag codes that differ only by case', async () => {
    const site = makeSite(HOME, {
      [PAGE_A]: {},
      [PAGE_B]: { hreflangOut: { en: PAGE_A } },
      [PAGE_C]: { hreflangOut: { EN: PAGE_A } },
    });
    const result = await hreflangIncomingConflictRule.run(pageIn(PAGE_A, site));
    expect(result.status).toBe('pass');
  });
});

describe('hreflangReciprocityRule', () => {
  it('reports unmeasured without crawl state', async () => {
    const result = await hreflangReciprocityRule.run(
      createTestContext('<html></html>', { url: PAGE_A })
    );
    expect(result.weight).toBe(0);
  });

  it('passes when the page has no hreflang annotations', async () => {
    const site = makeSite(HOME, { [PAGE_A]: {} });
    const result = await hreflangReciprocityRule.run(pageIn(PAGE_A, site));
    expect(result.status).toBe('pass');
  });

  it('reports unmeasured when none of the targets were crawled', async () => {
    const site = makeSite(HOME, {
      [PAGE_A]: { hreflangOut: { fr: 'https://example.com/uncrawled' } },
    });
    const result = await hreflangReciprocityRule.run(pageIn(PAGE_A, site));
    expect(result.weight).toBe(0);
  });

  it('warns when a crawled target does not link back', async () => {
    const site = makeSite(HOME, {
      [PAGE_A]: { hreflangOut: { en: PAGE_A, fr: PAGE_B } },
      [PAGE_B]: { hreflangOut: { fr: PAGE_B } },
    });
    const result = await hreflangReciprocityRule.run(pageIn(PAGE_A, site));
    expect(result.status).toBe('warn');
    const missing = result.details?.missingReturn as Array<{ code: string; target: string }>;
    expect(missing).toEqual([{ code: 'fr', target: PAGE_B }]);
  });

  it('passes when all crawled targets reciprocate', async () => {
    const site = makeSite(HOME, {
      [PAGE_A]: { hreflangOut: { en: PAGE_A, fr: PAGE_B } },
      [PAGE_B]: { hreflangOut: { fr: PAGE_B, en: PAGE_A } },
    });
    const result = await hreflangReciprocityRule.run(pageIn(PAGE_A, site));
    expect(result.status).toBe('pass');
    expect(result.details?.uncheckedTargets).toBe(0);
  });

  it('passes with a mixed set: reciprocating crawled targets plus uncrawled ones', async () => {
    const site = makeSite(HOME, {
      [PAGE_A]: {
        hreflangOut: { en: PAGE_A, fr: PAGE_B, de: 'https://example.com/uncrawled' },
      },
      [PAGE_B]: { hreflangOut: { en: PAGE_A } },
    });
    const result = await hreflangReciprocityRule.run(pageIn(PAGE_A, site));
    expect(result.status).toBe('pass');
    expect(result.details?.uncheckedTargets).toBe(1);
  });

  it('falls back to parsing the annotations from the HTML when the page has no crawl record', async () => {
    const site = makeSite(HOME, {
      [PAGE_B]: { hreflangOut: {} },
    });
    const html = `<html><head><link rel="alternate" hreflang="fr" href="${PAGE_B}"></head></html>`;
    const result = await hreflangReciprocityRule.run(pageIn(PAGE_A, site, html));
    expect(result.status).toBe('warn');
  });
});
