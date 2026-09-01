import { describe, it, expect } from 'vitest';
import { nonHttpProtocolRule } from './non-http-protocol.js';
import { inboundAllNofollowRule } from './inbound-all-nofollow.js';
import { inboundMixedFollowRule } from './inbound-mixed-follow.js';
import { inboundLowQualityRule } from './inbound-low-quality.js';
import { inboundAnchorTextRule } from './inbound-anchor-text.js';
import type { AuditContext, InboundEdge, SiteContext, SitePageInfo } from '../../types.js';
import { createTestContext } from '../test-context.js';

// Helper to create minimal AuditContext
function createContext(html: string): AuditContext {
  return createTestContext(html);
}

describe('nonHttpProtocolRule', () => {
  it('should pass when all links use HTTP(S)', async () => {
    const html = `<html><body>
      <a href="https://example.com/page">Internal</a>
      <a href="https://other.com/">External</a>
      <a href="/relative/path">Relative</a>
      <a href="#fragment">Fragment</a>
    </body></html>`;
    const result = await nonHttpProtocolRule.run(createContext(html));
    expect(result.status).toBe('pass');
  });

  it('should pass for tel: and mailto: links (handled by links-tel-mailto)', async () => {
    const html = `<html><body>
      <a href="tel:+1234567890">Call us</a>
      <a href="mailto:info@example.com">Email us</a>
    </body></html>`;
    const result = await nonHttpProtocolRule.run(createContext(html));
    expect(result.status).toBe('pass');
  });

  it('should pass when there are no links', async () => {
    const result = await nonHttpProtocolRule.run(
      createContext('<html><body><p>No links</p></body></html>')
    );
    expect(result.status).toBe('pass');
    expect(result.details?.totalLinksChecked).toBe(0);
  });

  it('should warn for ftp: links', async () => {
    const html = `<html><body>
      <a href="ftp://files.example.com/archive.zip">Download</a>
    </body></html>`;
    const result = await nonHttpProtocolRule.run(createContext(html));
    expect(result.status).toBe('warn');
    expect(result.details?.nonHttpLinkCount).toBe(1);
    expect(result.details?.protocols).toEqual(['ftp']);
  });

  it('should warn for file:, intent: and chrome: links', async () => {
    const html = `<html><body>
      <a href="file:///Users/dev/report.pdf">Local file</a>
      <a href="intent://scan/#Intent;scheme=zxing;end">Scan</a>
      <a href="chrome://extensions">Extensions</a>
    </body></html>`;
    const result = await nonHttpProtocolRule.run(createContext(html));
    expect(result.status).toBe('warn');
    expect(result.details?.nonHttpLinkCount).toBe(3);
    expect(result.details?.protocols).toEqual(['file', 'intent', 'chrome']);
  });

  it('should not flag javascript: links (covered by links-invalid-links)', async () => {
    const html = `<html><body>
      <a href="javascript:void(0)">Click</a>
    </body></html>`;
    const result = await nonHttpProtocolRule.run(createContext(html));
    expect(result.status).toBe('pass');
  });
});


// --- Inbound link quality rules (crawl-mode, per-edge link data) ---

const TARGET = 'https://example.com/target';
const SRC_A = 'https://example.com/a';
const SRC_B = 'https://example.com/b';

/**
 * Build a minimal SiteContext exposing inboundEdgesByUrl for TARGET.
 *
 * @param edges - Inbound edges pointing at TARGET (empty = nothing links here)
 * @param pages - Optional per-page crawl state for canonical checks
 */
function makeInboundSite(
  edges: InboundEdge[],
  pages?: Map<string, SitePageInfo>
): SiteContext {
  return {
    entryUrl: 'https://example.com/',
    pageCount: 3,
    depthByUrl: new Map(),
    inboundLinksByUrl: new Map(),
    outboundLinksByUrl: new Map(),
    normalize: (u: string) => u,
    pages,
    inboundEdgesByUrl: edges.length > 0 ? new Map([[TARGET, edges]]) : new Map(),
  };
}

function inboundContext(
  edges: InboundEdge[],
  pages?: Map<string, SitePageInfo>
): AuditContext {
  return createTestContext('<html><body></body></html>', {
    url: TARGET,
    site: makeInboundSite(edges, pages),
  });
}

describe('inboundAllNofollowRule', () => {
  it('should report unmeasured without a crawl (no site graph)', async () => {
    const result = await inboundAllNofollowRule.run(createContext('<html></html>'));
    expect(result.weight).toBe(0);
  });

  it('should report unmeasured when the crawl has no per-edge link data', async () => {
    const ctx = createTestContext('<html></html>', {
      url: TARGET,
      site: { ...makeInboundSite([]), inboundEdgesByUrl: undefined },
    });
    const result = await inboundAllNofollowRule.run(ctx);
    expect(result.weight).toBe(0);
  });

  it('should pass when nothing links to the page (links-orphan-pages covers that)', async () => {
    const result = await inboundAllNofollowRule.run(inboundContext([]));
    expect(result.status).toBe('pass');
  });

  it('should warn when every inbound internal link is nofollow', async () => {
    const result = await inboundAllNofollowRule.run(
      inboundContext([
        { from: SRC_A, nofollow: true, anchor: 'A' },
        { from: SRC_B, nofollow: true, anchor: 'B' },
      ])
    );
    expect(result.status).toBe('warn');
    expect(result.details?.nofollowCount).toBe(2);
  });

  it('should pass when at least one inbound link is followed', async () => {
    const result = await inboundAllNofollowRule.run(
      inboundContext([
        { from: SRC_A, nofollow: true, anchor: 'A' },
        { from: SRC_B, nofollow: false, anchor: 'B' },
      ])
    );
    expect(result.status).toBe('pass');
    expect(result.details?.followedCount).toBe(1);
  });
});

describe('inboundMixedFollowRule', () => {
  it('should report unmeasured without a crawl (no site graph)', async () => {
    const result = await inboundMixedFollowRule.run(createContext('<html></html>'));
    expect(result.weight).toBe(0);
  });

  it('should pass when nothing links to the page', async () => {
    const result = await inboundMixedFollowRule.run(inboundContext([]));
    expect(result.status).toBe('pass');
  });

  it('should warn when the page receives both followed and nofollowed links', async () => {
    const result = await inboundMixedFollowRule.run(
      inboundContext([
        { from: SRC_A, nofollow: false, anchor: 'A' },
        { from: SRC_B, nofollow: true, anchor: 'B' },
      ])
    );
    expect(result.status).toBe('warn');
    expect(result.details?.followedCount).toBe(1);
    expect(result.details?.nofollowCount).toBe(1);
  });

  it('should pass when all inbound links are followed', async () => {
    const result = await inboundMixedFollowRule.run(
      inboundContext([
        { from: SRC_A, nofollow: false, anchor: 'A' },
        { from: SRC_B, nofollow: false, anchor: 'B' },
      ])
    );
    expect(result.status).toBe('pass');
  });

  it('should pass when all inbound links are nofollow (links-inbound-all-nofollow covers that)', async () => {
    const result = await inboundMixedFollowRule.run(
      inboundContext([{ from: SRC_A, nofollow: true, anchor: 'A' }])
    );
    expect(result.status).toBe('pass');
  });
});

describe('inboundLowQualityRule', () => {
  it('should report unmeasured without a crawl (no site graph)', async () => {
    const result = await inboundLowQualityRule.run(createContext('<html></html>'));
    expect(result.weight).toBe(0);
  });

  it('should pass when nothing links to the page', async () => {
    const result = await inboundLowQualityRule.run(inboundContext([]));
    expect(result.status).toBe('pass');
  });

  it('should pass when a followed link comes from a self-canonical page', async () => {
    const pages = new Map<string, SitePageInfo>([
      [SRC_A, { statusCode: 200, canonical: SRC_A, noindex: false, nofollow: false, disallowed: false, hreflangOut: {} }],
    ]);
    const result = await inboundLowQualityRule.run(
      inboundContext([{ from: SRC_A, nofollow: false, anchor: 'About us' }], pages)
    );
    expect(result.status).toBe('pass');
    expect(result.details?.equityPassingCount).toBe(1);
  });

  it('should warn when every inbound link is nofollow', async () => {
    const result = await inboundLowQualityRule.run(
      inboundContext([{ from: SRC_A, nofollow: true, anchor: 'A' }])
    );
    expect(result.status).toBe('warn');
    expect(result.details?.equityPassingCount).toBe(0);
  });

  it('should warn when followed links come only from pages canonicalized elsewhere', async () => {
    const pages = new Map<string, SitePageInfo>([
      [SRC_A, { statusCode: 200, canonical: 'https://example.com/canonical-a', noindex: false, nofollow: false, disallowed: false, hreflangOut: {} }],
      [SRC_B, { statusCode: 200, canonical: 'https://example.com/canonical-b', noindex: false, nofollow: false, disallowed: false, hreflangOut: {} }],
    ]);
    const result = await inboundLowQualityRule.run(
      inboundContext(
        [
          { from: SRC_A, nofollow: false, anchor: 'A' },
          { from: SRC_B, nofollow: false, anchor: 'B' },
        ],
        pages
      )
    );
    expect(result.status).toBe('warn');
    expect(result.details?.canonicalizedSourceCount).toBe(2);
  });

  it('should pass when at least one followed link comes from a non-canonicalized page', async () => {
    const pages = new Map<string, SitePageInfo>([
      [SRC_A, { statusCode: 200, canonical: 'https://example.com/canonical-a', noindex: false, nofollow: false, disallowed: false, hreflangOut: {} }],
    ]);
    const result = await inboundLowQualityRule.run(
      inboundContext(
        [
          { from: SRC_A, nofollow: false, anchor: 'A' },
          { from: SRC_B, nofollow: false, anchor: 'B' },
        ],
        pages
      )
    );
    expect(result.status).toBe('pass');
  });

  it('should not treat an unrecorded source page as canonicalized away', async () => {
    // No pages map at all: the canonical check must not flip edges.
    const result = await inboundLowQualityRule.run(
      inboundContext([{ from: SRC_A, nofollow: false, anchor: 'A' }])
    );
    expect(result.status).toBe('pass');
    expect(result.details?.equityPassingCount).toBe(1);
  });
});

describe('inboundAnchorTextRule', () => {
  it('should report unmeasured without a crawl (no site graph)', async () => {
    const result = await inboundAnchorTextRule.run(createContext('<html></html>'));
    expect(result.weight).toBe(0);
  });

  it('should pass when nothing links to the page', async () => {
    const result = await inboundAnchorTextRule.run(inboundContext([]));
    expect(result.status).toBe('pass');
  });

  it('should warn when every followed inbound link uses a generic anchor', async () => {
    const result = await inboundAnchorTextRule.run(
      inboundContext([
        { from: SRC_A, nofollow: false, anchor: 'click here' },
        { from: SRC_B, nofollow: false, anchor: 'read more' },
      ])
    );
    expect(result.status).toBe('warn');
    expect(result.details?.genericAnchorCount).toBe(2);
  });

  it('should warn when followed inbound anchors are empty (image-only links)', async () => {
    const result = await inboundAnchorTextRule.run(
      inboundContext([{ from: SRC_A, nofollow: false, anchor: '' }])
    );
    expect(result.status).toBe('warn');
  });

  it('should pass when at least one followed inbound link uses a descriptive anchor', async () => {
    const result = await inboundAnchorTextRule.run(
      inboundContext([
        { from: SRC_A, nofollow: false, anchor: 'click here' },
        { from: SRC_B, nofollow: false, anchor: 'our pricing plans' },
      ])
    );
    expect(result.status).toBe('pass');
    expect(result.details?.genericAnchorCount).toBe(1);
  });

  it('should pass when there are no followed inbound links (links-inbound-all-nofollow covers that)', async () => {
    const result = await inboundAnchorTextRule.run(
      inboundContext([{ from: SRC_A, nofollow: true, anchor: 'click here' }])
    );
    expect(result.status).toBe('pass');
  });
});
