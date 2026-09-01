import type { AuditContext, SiteContext, SitePageInfo } from '../../types.js';

/**
 * Shared helpers for crawl-mode rules that cross-reference per-page crawl
 * state (`SiteContext.pages`) — canonical targets, hreflang targets and
 * robots.txt disallowed flags that only exist once a crawl has fetched the
 * other side of the relationship.
 */

/**
 * The crawl record for the page currently being audited, when present.
 */
export function getOwnPageInfo(context: AuditContext): SitePageInfo | undefined {
  const site = context.site;
  if (!site?.pages) return undefined;
  return site.pages.get(site.normalize(context.url));
}

/**
 * The page's canonical target as an absolute URL.
 *
 * Prefers the crawl record (already resolved by the crawler); falls back to
 * parsing the tag from the current page. Returns undefined when no canonical
 * is declared, null when one was declared but could not be resolved.
 */
export function resolveCanonical(context: AuditContext): string | null | undefined {
  const info = getOwnPageInfo(context);
  if (info && info.canonical !== undefined) return info.canonical;

  const href = context.$('link[rel="canonical"]').attr('href');
  if (!href) return undefined;
  try {
    return new URL(href, context.url).href;
  } catch {
    return null;
  }
}

/**
 * The page's outgoing hreflang annotations (code → absolute target URL).
 *
 * Prefers the crawl record; falls back to parsing the tags from the current
 * page. Unresolvable hrefs are dropped, matching the crawler's behaviour.
 */
export function resolveHreflangOut(context: AuditContext): Record<string, string> {
  const info = getOwnPageInfo(context);
  if (info) return info.hreflangOut;

  const out: Record<string, string> = {};
  context.$('link[rel="alternate"][hreflang]').each((_, el) => {
    const code = context.$(el).attr('hreflang');
    const href = context.$(el).attr('href');
    if (!code || !href) return;
    try {
      out[code.toLowerCase()] = new URL(href, context.url).href;
    } catch {
      // Unresolvable target - other rules report invalid hreflang URLs.
    }
  });
  return out;
}

/**
 * Look another URL up in the crawl's per-page records.
 */
export function lookupPage(site: SiteContext, url: string): SitePageInfo | undefined {
  return site.pages?.get(site.normalize(url));
}

/**
 * Whether two URLs are the same page under the crawl's normalisation.
 */
export function isSameUrl(site: SiteContext, a: string, b: string): boolean {
  return site.normalize(a) === site.normalize(b);
}

/**
 * Patterns in URLs that indicate a paginated page.
 *
 * Kept in sync with the table in pagination-orphaned.ts; that rule checks a
 * paginated URL for rel links, the rules using this table check the link
 * graph around it.
 */
const PAGINATION_URL_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /[?&]page=\d+/i, label: '?page=N' },
  { pattern: /[?&]p=\d+/i, label: '?p=N' },
  { pattern: /[?&]pg=\d+/i, label: '?pg=N' },
  { pattern: /[?&]offset=\d+/i, label: '?offset=N' },
  { pattern: /[?&]start=\d+/i, label: '?start=N' },
  { pattern: /[?&]paged=\d+/i, label: '?paged=N' },
  { pattern: /\/page\/\d+\/?$/i, label: '/page/N' },
];

/**
 * Whether the audited page looks like part of a pagination series: its URL
 * matches a common pagination pattern, or it declares itself a series member
 * with rel="next"/rel="prev".
 */
export function looksPaginated(context: AuditContext): { paginated: boolean; label?: string } {
  for (const { pattern, label } of PAGINATION_URL_PATTERNS) {
    if (pattern.test(context.url)) {
      return { paginated: true, label };
    }
  }
  if (context.$('link[rel="next"]').length > 0 || context.$('link[rel="prev"]').length > 0) {
    return { paginated: true, label: 'rel="next"/"prev"' };
  }
  return { paginated: false };
}

/** Upper bound when following canonical targets across pages */
const MAX_CANONICAL_HOPS = 10;

/**
 * The outcome of following a page's canonical target through the crawl's
 * per-page records.
 */
export type CanonicalWalk =
  | { kind: 'none' }
  | { kind: 'self' }
  | { kind: 'ok'; target: string }
  | { kind: 'unknown'; target: string }
  | {
      kind: 'chain';
      target: string;
      targetCanonical: string;
      /** False when the chain left the crawled set before reaching a final destination */
      resolved: boolean;
    }
  | { kind: 'loop'; path: string[] };

/**
 * Follow this page's canonical through `site.pages`.
 *
 * - `none`/`self`: no canonical declared, or it points back at this page.
 * - `ok`: the target was crawled and is a final canonical destination
 *   (self-referencing or undeclared).
 * - `unknown`: the chain leaves the crawled set before any verdict.
 * - `chain`: the immediate target canonicalises onward to a different URL;
 *   `resolved` tells whether the chain reached a final destination inside
 *   the crawled set.
 * - `loop`: following targets returns to a URL already visited.
 */
export function walkCanonical(context: AuditContext): CanonicalWalk {
  const site = context.site;
  if (!site?.pages) return { kind: 'unknown', target: '' };

  const canonical = resolveCanonical(context);
  if (!canonical) return { kind: 'none' };
  if (isSameUrl(site, canonical, context.url)) return { kind: 'self' };

  const path: string[] = [context.url, canonical];
  const visited = new Set<string>([site.normalize(context.url)]);
  let current = canonical;
  // Set when the immediate target canonicalises onward; a loop discovered
  // further along still takes precedence over this verdict.
  let chain: { target: string; targetCanonical: string } | null = null;

  for (let hop = 0; hop < MAX_CANONICAL_HOPS; hop++) {
    const currentKey = site.normalize(current);
    if (visited.has(currentKey)) {
      return { kind: 'loop', path };
    }
    visited.add(currentKey);

    const entry = site.pages.get(currentKey);
    if (!entry) {
      return chain
        ? { kind: 'chain', ...chain, resolved: false }
        : { kind: 'unknown', target: current };
    }
    const next = entry.canonical;
    if (!next || isSameUrl(site, next, current)) {
      return chain
        ? { kind: 'chain', ...chain, resolved: true }
        : { kind: 'ok', target: current };
    }
    if (hop === 0) {
      chain = { target: current, targetCanonical: next };
    }
    current = next;
    path.push(current);
  }

  return { kind: 'loop', path };
}
