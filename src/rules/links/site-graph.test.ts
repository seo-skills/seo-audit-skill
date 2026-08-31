import { describe, it, expect } from 'vitest';
import { orphanPagesRule } from './orphan-pages.js';
import { depthRule } from './depth.js';
import { createTestContext } from '../test-context.js';
import type { AuditContext, SiteContext } from '../../types.js';

/**
 * Build a SiteContext from a simple edge list.
 *
 * @param entry - Entry URL
 * @param edges - [from, to] internal link pairs
 * @param depths - Click depth per URL
 */
function makeSite(
  entry: string,
  edges: [string, string][],
  depths: Record<string, number>
): SiteContext {
  const inboundLinksByUrl = new Map<string, Set<string>>();
  const outboundLinksByUrl = new Map<string, Set<string>>();
  const pages = new Set<string>([entry]);

  for (const [from, to] of edges) {
    pages.add(from);
    pages.add(to);
    if (!outboundLinksByUrl.has(from)) outboundLinksByUrl.set(from, new Set());
    outboundLinksByUrl.get(from)!.add(to);
    if (!inboundLinksByUrl.has(to)) inboundLinksByUrl.set(to, new Set());
    inboundLinksByUrl.get(to)!.add(from);
  }

  return {
    entryUrl: entry,
    pageCount: pages.size,
    depthByUrl: new Map(Object.entries(depths)),
    inboundLinksByUrl,
    outboundLinksByUrl,
    // Identity normalisation keeps the fixtures readable.
    normalize: (u: string) => u,
  };
}

const HOME = 'https://example.com/';
const ABOUT = 'https://example.com/about';
const DEEP = 'https://example.com/deep';
const ORPHAN = 'https://example.com/orphan';

/** A small site: home → about → deep, plus an unlinked orphan. */
const site = makeSite(
  HOME,
  [
    [HOME, ABOUT],
    [ABOUT, DEEP],
  ],
  { [HOME]: 0, [ABOUT]: 1, [DEEP]: 2, [ORPHAN]: 4 }
);

function pageIn(url: string, s: SiteContext = site): AuditContext {
  return createTestContext('<html><body></body></html>', { url, site: s });
}

describe('orphanPagesRule', () => {
  it('reports unmeasured without a crawl (no site graph)', async () => {
    const result = await orphanPagesRule.run(createTestContext('<html></html>', { url: ABOUT }));
    expect(result.weight).toBe(0);
  });

  it('reports unmeasured when only one page was crawled', async () => {
    // A single-page crawl has no graph to judge orphan status against.
    const lonely = makeSite(HOME, [], { [HOME]: 0 });
    const result = await orphanPagesRule.run(pageIn(ABOUT, lonely));
    expect(result.weight).toBe(0);
  });

  it('fails a page nothing links to', async () => {
    const result = await orphanPagesRule.run(pageIn(ORPHAN));
    expect(result.status).toBe('fail');
    expect(result.details?.inboundLinkCount).toBe(0);
  });

  it('passes a page with inbound links', async () => {
    // ABOUT is linked from HOME.
    const result = await orphanPagesRule.run(pageIn(ABOUT));
    expect(result.details?.inboundLinkCount).toBe(1);
  });

  it('warns when a page hangs off a single inbound link', async () => {
    const result = await orphanPagesRule.run(pageIn(DEEP));
    expect(result.status).toBe('warn');
  });

  it('does not call the entry URL an orphan', async () => {
    // Nothing inside the crawl links "down" to where it started.
    const result = await orphanPagesRule.run(pageIn(HOME));
    expect(result.status).toBe('pass');
  });

  it('passes a well-linked page', async () => {
    const wellLinked = makeSite(
      HOME,
      [[HOME, ABOUT], [DEEP, ABOUT], ['https://example.com/x', ABOUT]],
      { [HOME]: 0, [ABOUT]: 1 }
    );
    const result = await orphanPagesRule.run(pageIn(ABOUT, wellLinked));
    expect(result.status).toBe('pass');
    expect(result.details?.inboundLinkCount).toBe(3);
  });
});

describe('depthRule', () => {
  it('reports unmeasured without a crawl', async () => {
    const result = await depthRule.run(createTestContext('<html></html>', { url: ABOUT }));
    expect(result.weight).toBe(0);
  });

  it('measures click distance, not URL nesting', async () => {
    // A deeply nested URL linked straight from the entry point is depth 1.
    const nested = 'https://example.com/a/b/c/d/e';
    const s = makeSite(HOME, [[HOME, nested]], { [HOME]: 0, [nested]: 1 });
    const result = await depthRule.run(pageIn(nested, s));
    expect(result.status).toBe('pass');
    expect(result.details?.depth).toBe(1);
  });

  it('passes the entry point at depth 0', async () => {
    const result = await depthRule.run(pageIn(HOME));
    expect(result.details?.depth).toBe(0);
  });

  it('warns beyond the 3-click guideline', async () => {
    const s = makeSite(HOME, [[HOME, DEEP]], { [HOME]: 0, [DEEP]: 4 });
    expect((await depthRule.run(pageIn(DEEP, s))).status).toBe('warn');
  });

  it('fails a badly buried page', async () => {
    const s = makeSite(HOME, [[HOME, DEEP]], { [HOME]: 0, [DEEP]: 7 });
    expect((await depthRule.run(pageIn(DEEP, s))).status).toBe('fail');
  });
});
