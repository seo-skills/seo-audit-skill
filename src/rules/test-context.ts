import * as cheerio from 'cheerio';
import type { AuditContext, SiteContext, SitePageInfo } from '../types.js';

/**
 * Builds a complete AuditContext for rule tests.
 *
 * Rules destructure context fields and dereference them without guarding, so a
 * hand-built context that omits one produces a TypeError that the Auditor
 * records as a score-0 rule failure — the exact defect that shipped in the
 * `analyze` command. Centralising the shape here means adding a field to
 * AuditContext updates every test at once instead of leaving stale literals
 * scattered across the suite.
 *
 * @param html - Page HTML; also used to build the Cheerio instance
 * @param overrides - Any context fields to replace
 */
export function createTestContext(
  html: string,
  overrides: Partial<AuditContext> = {}
): AuditContext {
  return {
    url: 'https://example.com/',
    html,
    $: cheerio.load(html),
    headers: {},
    statusCode: 200,
    responseTime: 100,
    cwv: {},
    links: [],
    images: [],
    invalidLinks: [],
    specialLinks: [],
    figures: [],
    inlineSvgs: [],
    pictureElements: [],
    ...overrides,
  };
}

/** One page of a crawl built for a cross-page rule test */
export interface TestPage {
  url: string;
  html: string;
  statusCode?: number;
  headers?: Record<string, string>;
}

/**
 * Build a crawl's SiteContext from pages, the way the crawler builds it, and
 * return each page's context wired to it. Cross-page rules read the finished
 * crawl, so a test needs every page in place before it runs any of them.
 */
export async function createTestSite(pages: TestPage[]): Promise<{ site: SiteContext; contexts: Map<string, AuditContext> }> {
  // Imported here so rule tests that never build a site do not load the crawler
  const { buildSitePageInfo } = await import('../crawler/crawler.js');
  const normalize = (url: string) => new URL(url).href;
  const contexts = new Map<string, AuditContext>();
  const records = new Map<string, SitePageInfo>();
  for (const page of pages) {
    const context = createTestContext(page.html, {
      url: page.url,
      statusCode: page.statusCode ?? 200,
      headers: page.headers ?? {},
    });
    contexts.set(page.url, context);
    records.set(normalize(page.url), buildSitePageInfo({ url: page.url, context }, false));
  }
  const site = {
    entryUrl: normalize(pages[0].url),
    pageCount: pages.length,
    depthByUrl: new Map(),
    inboundLinksByUrl: new Map(),
    outboundLinksByUrl: new Map(),
    pages: records,
    normalize,
  } as unknown as SiteContext;
  // The link graph, as the crawler records it: internal, no self-links
  for (const context of contexts.values()) {
    const from = normalize(context.url);
    for (const link of context.links) {
      if (!link.isInternal) continue;
      const to = normalize(new URL(link.href, context.url).href);
      if (to === from) continue;
      if (!site.inboundLinksByUrl.has(to)) site.inboundLinksByUrl.set(to, new Set());
      site.inboundLinksByUrl.get(to)!.add(from);
      if (!site.outboundLinksByUrl.has(from)) site.outboundLinksByUrl.set(from, new Set());
      site.outboundLinksByUrl.get(from)!.add(to);
    }
  }
  for (const context of contexts.values()) context.site = site;
  return { site, contexts };
}
