import { describe, expect, it, afterEach, vi } from 'vitest';
import type { SchemaNodeSummary, SiteContext, SitePageInfo } from '../types.js';
import { createTestContext } from './test-context.js';
import { ariaRequiredRule } from './a11y/aria-required.js';
import { thinVsSiteRule } from './content/thin-vs-site.js';
import { titlePatternRule } from './content/title-pattern.js';
import { pdfSizeRule } from './crawl/pdf-size.js';
import { napConsistencyRule } from './eeat/nap-consistency.js';
import { markdownPageRule } from './geo/markdown-page.js';
import { payPerCrawlRule } from './geo/pay-per-crawl.js';
import { entitySplitRule } from './schema/entity-split.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

function info(partial: Partial<SitePageInfo> = {}): SitePageInfo {
  return {
    statusCode: 200,
    noindex: false,
    nofollow: false,
    disallowed: false,
    hreflangOut: {},
    ...partial,
  };
}

function site(pages: Record<string, Partial<SitePageInfo>>): SiteContext {
  const map = new Map<string, SitePageInfo>();
  for (const [url, page] of Object.entries(pages)) map.set(url, info(page));
  return {
    entryUrl: 'https://example.com/',
    pageCount: map.size,
    depthByUrl: new Map(),
    inboundLinksByUrl: new Map(),
    outboundLinksByUrl: new Map(),
    pages: map,
    normalize: (url) => url,
  };
}

describe('remaining coverage rules', () => {
  it('is not measured for thin-versus-site without a crawl', async () => {
    const result = await thinVsSiteRule.run(createTestContext('<html><body><p>Short.</p></body></html>'));
    expect(result.status).toBe('not-measured');
  });

  it('warns when an article is far below the article median', async () => {
    const pages: Record<string, Partial<SitePageInfo>> = {
      'https://example.com/a': { pageKind: 'article', wordCount: 80, title: 'A | Brand' },
    };
    for (let i = 0; i < 4; i++) {
      pages[`https://example.com/long-${i}`] = { pageKind: 'article', wordCount: 1000, title: `Long ${i} | Brand` };
    }
    const result = await thinVsSiteRule.run(
      createTestContext('<html><body><p>Short.</p></body></html>', {
        url: 'https://example.com/a',
        site: site(pages),
      })
    );
    expect(result.status).toBe('warn');
  });

  it('warns when a title drops the shared suffix', async () => {
    const pages: Record<string, Partial<SitePageInfo>> = {
      'https://example.com/odd': { title: 'A page with no suffix' },
    };
    for (let i = 0; i < 4; i++) {
      pages[`https://example.com/p-${i}`] = { title: `Page ${i} | Acme` };
    }
    const result = await titlePatternRule.run(
      createTestContext('<html><head><title>A page with no suffix</title></head></html>', {
        url: 'https://example.com/odd',
        site: site(pages),
      })
    );
    expect(result.status).toBe('warn');
  });

  it('warns when one name has two absolute ids', async () => {
    const nodes = (id: string): SchemaNodeSummary[] => [
      { id, types: ['Organization'], name: 'Acme', refs: [] },
    ];
    const result = await entitySplitRule.run(
      createTestContext('<html></html>', {
        site: site({
          'https://example.com/a': { schemaNodes: nodes('https://example.com/#a') },
          'https://example.com/b': { schemaNodes: nodes('https://example.com/#b') },
        }),
      })
    );
    expect(result.status).toBe('warn');
  });

  it('warns when one name has two phone numbers', async () => {
    const node = (telephone: string): SchemaNodeSummary => ({
      id: 'https://example.com/#org',
      types: ['Organization'],
      name: 'Acme',
      telephone,
      refs: [],
    });
    const result = await napConsistencyRule.run(
      createTestContext('<html></html>', {
        site: site({
          'https://example.com/a': { schemaNodes: [node('+1 555 0100')] },
          'https://example.com/b': { schemaNodes: [node('+1 555 0199')] },
        }),
      })
    );
    expect(result.status).toBe('warn');
  });

  it('passes the site root for per-url markdown', async () => {
    const result = await markdownPageRule.run(createTestContext('<html></html>', { url: 'https://example.com/' }));
    expect(result.status).toBe('pass');
  });

  it('warns when a deeper URL has no markdown', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html></html>', { status: 200, headers: { 'content-type': 'text/html' } })));
    const result = await markdownPageRule.run(
      createTestContext('<html></html>', { url: 'https://example.com/pricing' })
    );
    expect(result.status).toBe('warn');
  });

  it('warns on a 402 with no payment terms', async () => {
    const result = await payPerCrawlRule.run(createTestContext('<html></html>', { statusCode: 402, headers: {} }));
    expect(result.status).toBe('warn');
  });

  it('passes a 402 that names a price', async () => {
    const result = await payPerCrawlRule.run(
      createTestContext('<html></html>', { statusCode: 402, headers: { 'crawler-price': '0.01 USD' } })
    );
    expect(result.status).toBe('pass');
  });

  it('warns when a tab is outside a tablist', async () => {
    const result = await ariaRequiredRule.run(
      createTestContext('<html><body><button role="tab">One</button></body></html>')
    );
    expect(result.status).toBe('warn');
  });

  it('passes a tab inside a tablist', async () => {
    const html = '<html><body><div role="tablist"><button role="tab">One</button></div></body></html>';
    const result = await ariaRequiredRule.run(createTestContext(html));
    expect(result.status).toBe('pass');
  });

  it('warns when a linked PDF advertises more than 10 MB', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 200, headers: { 'content-length': String(11 * 1024 * 1024) } }))
    );
    const result = await pdfSizeRule.run(
      createTestContext('<html><body><a href="/guide.pdf">Guide</a></body></html>')
    );
    expect(result.status).toBe('warn');
  });

  it('passes when the page has no PDF links', async () => {
    const result = await pdfSizeRule.run(createTestContext('<html><body><a href="/about">About</a></body></html>'));
    expect(result.status).toBe('pass');
  });
});
