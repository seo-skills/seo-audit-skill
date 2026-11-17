/**
 * Cross-page comparisons over the finished crawl.
 *
 * Duplicate checks used to keep module-level registries filled as pages were
 * scored, so the first page of a duplicate group passed and only the later
 * ones were flagged, and the answer depended on scoring order. Everything
 * here reads `site.pages`, which is complete before scoring starts, so every
 * member of a group is flagged and the order pages are scored in cannot
 * change a verdict.
 */

import type { RuleOptionSpec, RuleOptionValues, SiteContext, SitePageInfo } from '../types.js';
import { findNearDuplicates, type NearDuplicateAnalysis } from './near-duplicates.js';

/** Which pages a duplicate check compares */
export interface EligibilityOptions {
  /** Compare later pages of a series too (they repeat the first page's title by design) */
  includePaginated?: boolean;
  /** Compare noindex, robots-blocked and canonicalised pages too */
  includeNonIndexable?: boolean;
}

export type Eligibility = { eligible: true } | { eligible: false; reason: string };

/**
 * How a crawled page's fetch ended, for cross-page checks.
 *
 * `unknown` covers a page that could not be fetched (status 0) or that the
 * site rate-limited: a check must not read either as "broken" or "missing".
 */
export function pageOutcome(info: Pick<SitePageInfo, 'statusCode'> & { rateLimited?: boolean }): 'ok' | 'error' | 'unknown' {
  if (info.rateLimited || info.statusCode === 0) return 'unknown';
  return info.statusCode >= 200 && info.statusCode < 300 ? 'ok' : 'error';
}

/**
 * Whether a page takes part in duplicate comparisons, and why not.
 *
 * Mirrors what a search engine would index: a page that returned 200, is not
 * kept out of the index, names itself (or nothing) as canonical, and is not a
 * later page of a series. A page outside that set is not compared at all.
 */
export function pageEligibility(site: SiteContext, url: string, options: EligibilityOptions = {}): Eligibility {
  const key = site.normalize(url);
  const info = site.pages?.get(key);
  if (!info) return { eligible: false, reason: 'not in the crawl records' };

  const outcome = pageOutcome(info);
  if (outcome === 'unknown') return { eligible: false, reason: 'the page could not be fetched' };
  if (outcome === 'error') return { eligible: false, reason: `the page returned HTTP ${info.statusCode}` };

  if (!options.includeNonIndexable) {
    if (info.noindex) return { eligible: false, reason: 'noindex' };
    if (info.disallowed) return { eligible: false, reason: 'blocked by robots.txt' };
    if (info.canonical && site.normalize(info.canonical) !== key) {
      return { eligible: false, reason: `canonicalised to ${info.canonical}` };
    }
  }
  if (!options.includePaginated && info.isPaginated) {
    return { eligible: false, reason: 'a later page of a paginated series' };
  }
  return { eligible: true };
}

/** The fields compared by exact value */
export type GroupField = 'title' | 'description' | 'exactContent' | 'h1' | 'ogTitle' | 'ogDescription';

/** Trim, collapse whitespace, ignore case */
function textKey(value: string | undefined): string | undefined {
  const key = value?.toLowerCase().replace(/\s+/g, ' ').trim();
  return key ? key : undefined;
}

function keyOf(field: GroupField, info: SitePageInfo): string | undefined {
  switch (field) {
    case 'title':
      return textKey(info.title);
    case 'description':
      return textKey(info.description);
    case 'ogTitle':
      return textKey(info.ogTitle);
    case 'ogDescription':
      return textKey(info.ogDescription);
    case 'h1':
      // Exact text, as the H1 check has always compared it
      return info.h1?.trim() || undefined;
    case 'exactContent':
      return info.contentHash;
  }
}

/** Per-crawl memo: key → URLs, for each field and eligibility setting */
const groupCache = new WeakMap<SiteContext, Map<string, Map<string, string[]>>>();

function eligibilityKey(options: EligibilityOptions): string {
  return `${options.includePaginated ? 'p' : '-'}${options.includeNonIndexable ? 'n' : '-'}`;
}

function groupsFor(site: SiteContext, field: GroupField, options: EligibilityOptions): Map<string, string[]> {
  let perSite = groupCache.get(site);
  if (!perSite) groupCache.set(site, (perSite = new Map()));
  const cacheKey = `${field}:${eligibilityKey(options)}`;
  const cached = perSite.get(cacheKey);
  if (cached) return cached;

  const groups = new Map<string, string[]>();
  for (const [url, info] of site.pages ?? []) {
    if (!pageEligibility(site, url, options).eligible) continue;
    const key = keyOf(field, info);
    if (key === undefined) continue;
    const urls = groups.get(key);
    if (urls) urls.push(url);
    else groups.set(key, [url]);
  }
  for (const urls of groups.values()) urls.sort();
  perSite.set(cacheKey, groups);
  return groups;
}

/**
 * The other eligible pages sharing this page's value for `field`, sorted.
 *
 * @returns An empty list for a unique value; undefined when the page has no
 *          value for the field
 */
export function duplicatesOf(
  site: SiteContext,
  url: string,
  field: GroupField,
  options: EligibilityOptions = {}
): string[] | undefined {
  const key = site.normalize(url);
  const info = site.pages?.get(key);
  if (!info) return undefined;
  const value = keyOf(field, info);
  if (value === undefined) return undefined;
  const group = groupsFor(site, field, options).get(value) ?? [];
  return group.filter((other) => other !== key);
}

const nearCache = new WeakMap<SiteContext, Map<string, NearDuplicateAnalysis>>();

/**
 * Near-duplicate pairs among eligible pages, computed once per crawl and
 * shared by every page's check.
 */
export function nearDuplicateAnalysis(
  site: SiteContext,
  options: EligibilityOptions,
  minSimilarity: number
): NearDuplicateAnalysis {
  let perSite = nearCache.get(site);
  if (!perSite) nearCache.set(site, (perSite = new Map()));
  const cacheKey = `${eligibilityKey(options)}:${minSimilarity}`;
  const cached = perSite.get(cacheKey);
  if (cached) return cached;

  const pages = [];
  for (const [url, info] of site.pages ?? []) {
    if (!info.shingles || info.shingles.length < 5) continue;
    if (!pageEligibility(site, url, options).eligible) continue;
    pages.push({ url, shingles: info.shingles });
  }
  const analysis = findNearDuplicates(pages, minSimilarity);
  perSite.set(cacheKey, analysis);
  return analysis;
}

/** At most this many URLs are listed in a finding; the total is always given */
export const MAX_LISTED_URLS = 20;

/** The options every duplicate check declares, so a project can widen the comparison */
export const ELIGIBILITY_RULE_OPTIONS: Record<string, RuleOptionSpec> = {
  include_paginated: {
    type: 'boolean',
    default: false,
    description: 'Also compare later pages of a series, which repeat the first page by design',
  },
  include_non_indexable: {
    type: 'boolean',
    default: false,
    description: 'Also compare noindex, robots-blocked and canonicalised pages',
  },
};

/** Read the eligibility options a rule received */
export function eligibilityFrom(options: RuleOptionValues): EligibilityOptions {
  return {
    includePaginated: options.include_paginated === true,
    includeNonIndexable: options.include_non_indexable === true,
  };
}

/** A capped list of URLs for a finding's details, with the total */
export function listedUrls(urls: string[]): { urls: string[]; total: number } {
  return { urls: urls.slice(0, MAX_LISTED_URLS), total: urls.length };
}
