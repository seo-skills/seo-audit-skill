/**
 * Internal Link Score: PageRank over the crawl's links, rescaled to 0-100.
 */
import { describe, it, expect } from 'vitest';
import { computeLinkScores, linkScoreSummary } from './link-score.js';
import type { InboundEdge, SiteContext, SitePageInfo } from '../types.js';

interface Spec {
  /** page -> pages it links to; prefix a target with "!" for nofollow */
  links: Record<string, string[]>;
  canonical?: Record<string, string>;
  redirects?: Record<string, string>;
  status?: Record<string, number>;
}

const U = (name: string) => `https://example.com/${name}`;

function site({ links, canonical = {}, redirects = {}, status = {} }: Spec): SiteContext {
  const pages = new Map<string, SitePageInfo>();
  const inbound = new Map<string, InboundEdge[]>();
  for (const [from, targets] of Object.entries(links)) {
    pages.set(U(from), {
      statusCode: status[from] ?? 200,
      ...(canonical[from] && { canonical: U(canonical[from]) }),
      hreflangOut: {},
      isNoindex: false,
    } as unknown as SitePageInfo);
    for (const raw of targets) {
      const nofollow = raw.startsWith('!');
      const to = U(nofollow ? raw.slice(1) : raw);
      if (!inbound.has(to)) inbound.set(to, []);
      inbound.get(to)!.push({ from: U(from), nofollow, anchor: '', chrome: false } as InboundEdge);
    }
  }
  return {
    entryUrl: U(Object.keys(links)[0]),
    pageCount: pages.size,
    depthByUrl: new Map(),
    inboundLinksByUrl: new Map(),
    outboundLinksByUrl: new Map(),
    pages,
    inboundEdgesByUrl: inbound,
    redirectTargetByUrl: new Map(Object.entries(redirects).map(([a, b]) => [U(a), U(b)])),
    normalize: (url: string) => url,
  };
}

const score = (scores: Map<string, number>, name: string) => scores.get(U(name));

describe('computeLinkScores', () => {
  it('matches a hand-computed star: the hub 100, each leaf 53.4', () => {
    const scores = computeLinkScores(
      site({ links: { hub: ['l1', 'l2', 'l3', 'l4'], l1: ['hub'], l2: ['hub'], l3: ['hub'], l4: ['hub'] } })
    );
    expect(score(scores, 'hub')).toBe(100);
    for (const leaf of ['l1', 'l2', 'l3', 'l4']) expect(score(scores, leaf)).toBe(53.4);
  });

  it("gives a canonicalised duplicate's score to its canonical", () => {
    const links = { a: ['b'], b: ['a', 'd'], d: ['c'], c: ['a'] };
    const plain = computeLinkScores(site({ links }));
    const canonicalised = computeLinkScores(site({ links, canonical: { d: 'a' } }));
    // Scores are relative to the best-linked page, which is a either way; what
    // moves is c, which d no longer feeds once d hands everything to a
    expect(score(canonicalised, 'a')).toBe(100);
    expect(score(canonicalised, 'c')!).toBeLessThan(score(plain, 'c')!);
  });

  it('folds a redirecting alias into its final URL, never adding a node', () => {
    const scores = computeLinkScores(site({ links: { a: ['old'], old: ['a'], b: ['a'] }, redirects: { old: 'new' }, status: {} }));
    expect(scores.has(U('old'))).toBe(false);
    expect(scores.has(U('new'))).toBe(true);
  });

  it('counts a nofollow link in the out-degree and passes nothing through it', () => {
    const scores = computeLinkScores(site({ links: { a: ['b', '!c'], b: ['a'], c: ['a'] } }));
    expect(score(scores, 'c')).toBe(0);
  });

  it('leaves out pages that did not answer 200', () => {
    const scores = computeLinkScores(site({ links: { a: ['b'], b: ['a'], gone: ['a'] }, status: { gone: 404 } }));
    expect(scores.has(U('gone'))).toBe(false);
  });

  it('scores every page 100 when they are all linked alike, or there is one', () => {
    const cycle = computeLinkScores(site({ links: { a: ['b'], b: ['c'], c: ['a'] } }));
    expect([...cycle.values()]).toEqual([100, 100, 100]);
    expect([...computeLinkScores(site({ links: { only: [] } })).values()]).toEqual([100]);
  });

  it('computes 10,000 pages in under 2 seconds', () => {
    const links: Record<string, string[]> = {};
    for (let i = 0; i < 10_000; i++) links[`p${i}`] = Array.from({ length: 20 }, (_, j) => `p${(i * 7 + j * 131) % 10_000}`);
    const started = performance.now();
    const scores = computeLinkScores(site({ links }));
    expect(scores.size).toBe(10_000);
    expect(performance.now() - started).toBeLessThan(2000);
  });
});

describe('linkScoreSummary', () => {
  it('lists the best-linked pages and the weakest indexable ones', () => {
    const s = site({ links: { hub: ['l1', 'l2'], l1: ['hub'], l2: ['hub'] } });
    const summary = linkScoreSummary(s, computeLinkScores(s), 1);
    expect(summary.top).toEqual([{ url: U('hub'), score: 100 }]);
    expect(summary.lowestIndexable).toHaveLength(1);
  });
});

describe('Link Score in a crawl, a stored audit and a report', () => {
  it('comes with a crawl, is stored in its own table, and renders', async () => {
    const { vi } = await import('vitest');
    const { Auditor } = await import('../auditor.js');
    const { tempDatabase } = await import('../storage/audits-db/test-fixtures.js');
    const { saveAuditToDatabase } = await import('../storage/save-audit.js');
    const { getAuditDetail } = await import('../dashboard/queries.js');
    const { renderMarkdownReport } = await import('../reporters/markdown-reporter.js');

    const html = (links: string[]) =>
      `<!doctype html><html lang="en"><head><title>Page</title></head><body>${links.map((l) => `<a href="${l}">${l}</a>`).join('')}</body></html>`;
    const pages: Record<string, string[]> = { '/': ['/a', '/b'], '/a': ['/'], '/b': ['/', '/a'] };
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const path = new URL(String(input instanceof Request ? input.url : input)).pathname;
        return pages[path]
          ? new Response(html(pages[path]), { headers: { 'content-type': 'text/html' } })
          : new Response('', { status: 404 });
      })
    );
    try {
      const result = await new Auditor({ measureCwv: false, categories: ['core'] }).auditWithCrawl('https://site.test/', 3, 1);
      expect(Object.keys(result.extras?.linkScores ?? {})).toHaveLength(3);
      expect(result.extras?.linkScoreSummary?.top[0].score).toBe(100);

      const temp = tempDatabase();
      try {
        const saved = saveAuditToDatabase(result, { db: temp.db });
        const row = temp.db.getDb().prepare('SELECT extras_json FROM audits WHERE audit_id = ?').get(saved.auditId) as { extras_json: string };
        expect(JSON.parse(row.extras_json).linkScores).toBeUndefined();
        expect(JSON.parse(row.extras_json).linkScoreSummary).toBeDefined();
        expect(getAuditDetail(temp.db, saved.auditId)!.result.extras?.linkScores).toEqual(result.extras?.linkScores);
      } finally {
        temp.cleanup();
      }

      expect(renderMarkdownReport(result)).toContain('## Link Score');
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
