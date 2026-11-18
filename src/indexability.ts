/**
 * Can search engines index this page, and which URL does it say it is?
 *
 * One classifier for every part of the engine that asks: the score caps, the
 * crawl's per-page records and the cross-page checks built on them. Two
 * readers with different scoping is how a page can be excluded by one
 * subsystem and flagged by another.
 */

import type { CheerioAPI } from 'cheerio';
import { parseRobotsDirectives } from './rules/core/robots-meta.js';

/** What the classifier needs from a page */
export interface IndexabilityInput {
  $: CheerioAPI;
  headers: Record<string, string>;
  url: string;
}

/**
 * Directives written `name: value`. Inside an X-Robots-Tag they look like a
 * user-agent prefix and must not be read as one.
 */
const VALUED_DIRECTIVES = new Set(['max-snippet', 'max-image-preview', 'max-video-preview', 'unavailable_after']);

/**
 * The robots directives Google follows for this page.
 *
 * Reads the `robots` and `googlebot` meta tags, and the X-Robots-Tag header.
 * A header segment prefixed with a crawler name applies to that crawler, and
 * so do the segments after it: in `bingbot: nofollow, noindex` both
 * directives are Bing's. Only unprefixed and `googlebot:` directives count.
 */
export function googleRobotsDirectives({ $, headers }: Pick<IndexabilityInput, '$' | 'headers'>): string[] {
  const tokens: string[] = [];

  $('meta[name="robots" i], meta[name="googlebot" i]').each((_, el) => {
    tokens.push(...parseRobotsDirectives($(el).attr('content') ?? ''));
  });

  let agent: string | null = null; // null: the directive applies to every crawler
  for (const segment of (headers['x-robots-tag'] ?? '').split(',')) {
    let directive = segment;
    const prefixed = /^\s*([a-z][a-z0-9_-]*)\s*:(.*)$/i.exec(segment);
    if (prefixed && !VALUED_DIRECTIVES.has(prefixed[1].toLowerCase())) {
      agent = prefixed[1].toLowerCase();
      directive = prefixed[2];
    }
    if (agent === null || agent === 'googlebot') {
      tokens.push(...parseRobotsDirectives(directive));
    }
  }
  return tokens;
}

/**
 * The raw directive text Google reads, unsplit: each `robots` and `googlebot`
 * meta content, and the Google-scoped parts of X-Robots-Tag joined by commas.
 *
 * For directives whose value can hold a comma (an `unavailable_after` date
 * such as `Fri, 25 Jun 2026 15:00:00 PST`), which `googleRobotsDirectives`
 * would cut in two.
 */
export function googleRobotsText({ $, headers }: Pick<IndexabilityInput, '$' | 'headers'>): Array<{ source: 'meta' | 'header'; text: string }> {
  const out: Array<{ source: 'meta' | 'header'; text: string }> = [];
  $('meta[name="robots" i], meta[name="googlebot" i]').each((_, el) => {
    out.push({ source: 'meta', text: $(el).attr('content') ?? '' });
  });

  const applicable: string[] = [];
  let agent: string | null = null;
  for (const segment of (headers['x-robots-tag'] ?? '').split(',')) {
    let directive = segment;
    const prefixed = /^\s*([a-z][a-z0-9_-]*)\s*:(.*)$/i.exec(segment);
    if (prefixed && !VALUED_DIRECTIVES.has(prefixed[1].toLowerCase())) {
      agent = prefixed[1].toLowerCase();
      directive = prefixed[2];
    }
    if (agent === null || agent === 'googlebot') applicable.push(directive);
  }
  if (applicable.join('').trim()) out.push({ source: 'header', text: applicable.join(',') });
  return out;
}

/** Whether Google is told not to index the page */
export function isNoindex(page: Pick<IndexabilityInput, '$' | 'headers'>): boolean {
  const tokens = googleRobotsDirectives(page);
  return tokens.includes('noindex') || tokens.includes('none');
}

/** Whether Google is told not to follow the page's links */
export function isNofollow(page: Pick<IndexabilityInput, '$' | 'headers'>): boolean {
  const tokens = googleRobotsDirectives(page);
  return tokens.includes('nofollow') || tokens.includes('none');
}

/**
 * The canonical URL from an HTTP `Link` header, resolved, or undefined.
 *
 * `Link: <https://example.com/a>; rel="canonical"`. Several links may share
 * one header, separated by commas outside the angle brackets.
 */
export function canonicalFromLinkHeader(header: string | undefined, base: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(/,(?=\s*<)/)) {
    const match = /^\s*<([^>]*)>\s*(.*)$/.exec(part);
    if (!match) continue;
    const rel = /(?:^|;)\s*rel\s*=\s*"?([^";]+)"?/i.exec(match[2])?.[1] ?? '';
    if (!rel.toLowerCase().split(/\s+/).includes('canonical')) continue;
    try {
      return new URL(match[1], base).href;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

/**
 * The page's declared canonical: the `<link rel="canonical">` element first,
 * then the HTTP `Link` header.
 *
 * @returns The resolved URL; null when a canonical was declared but its href
 *          cannot be resolved; undefined when none was declared
 */
export function readCanonical({ $, headers, url }: IndexabilityInput): string | null | undefined {
  const href = $('link[rel="canonical"]').first().attr('href');
  if (href !== undefined) {
    try {
      return new URL(href, url).href;
    } catch {
      return null;
    }
  }
  return canonicalFromLinkHeader(headers['link'], url);
}

/**
 * URL shapes of a later page in a series. Narrower than "ends in a number":
 * `/products/12345` is a product, not page 12345.
 */
const PAGINATION_URL_PATTERNS = [
  /[?&]page=\d+/i,
  /[?&]p=\d+/i,
  /[?&]pg=\d+/i,
  /[?&]paged=\d+/i,
  /\/page\/\d+\/?$/i,
];

/**
 * Whether the page is a later page of a series (page 2 and on).
 *
 * `rel="prev"` marks it; `rel="next"` alone does not, because the first page
 * of a series links forward and is the page that should be compared.
 */
export function isPaginatedPage({ $, url }: Pick<IndexabilityInput, '$' | 'url'>): boolean {
  if (PAGINATION_URL_PATTERNS.some((pattern) => pattern.test(url))) return true;
  return $('link[rel="prev"]').length > 0;
}
