/**
 * External link checking for a whole run.
 *
 * Every unique external target across the run's pages is checked once, most
 * linked first, within a budget. `links-external-valid` then reads each page's
 * verdicts from the result instead of fetching, and the run's report lists
 * broken targets with the pages that link to them.
 */
import type { LinkInfo } from '../types.js';
import { RequestAbandonedError, type UrlInfo, type UrlService } from '../net/url-service.js';

export interface ExternalLinkCheck {
  /** `false` when `[external_links] enabled = false`: nothing was requested */
  enabled: boolean;
  /** Target URL (no fragment) to its answer */
  results: Map<string, UrlInfo>;
  /** Targets the budget did not reach: never counted either way */
  notChecked: Set<string>;
  /** Target URL to the pages that link to it, in page order */
  linkedFrom: Map<string, string[]>;
}

export interface ExternalLinkBudget {
  maxUrls: number;
  budgetMs: number;
}

/** A single-page audit gives the rule this long */
export const SINGLE_PAGE_BUDGET_MS = 30_000;

/** Listed in `extras.externalLinks`; the counts always cover everything */
const MAX_LISTED_TARGETS = 500;
const MAX_LISTED_PAGES = 20;

export const EXTERNAL_LINKS_DISABLED: ExternalLinkCheck = {
  enabled: false,
  results: new Map(),
  notChecked: new Set(),
  linkedFrom: new Map(),
};

/** The URL to request for an external link, or null for one that is not http(s) */
export function externalTarget(href: string): string | null {
  try {
    const url = new URL(href);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    url.hash = '';
    return url.href;
  } catch {
    return null;
  }
}

/**
 * Check every external link on `pages`, each target once.
 *
 * Targets linked from the most pages go first, so a budget that runs out
 * leaves the least-linked ones unchecked. A target the budget did not reach
 * is listed as not checked; it never makes a page pass or warn.
 */
export async function checkExternalLinks(
  service: UrlService,
  pages: Array<{ url: string; links: LinkInfo[] }>,
  budget: ExternalLinkBudget,
  onStart?: (targets: number) => void
): Promise<ExternalLinkCheck> {
  const linkedFrom = new Map<string, string[]>();
  for (const page of pages) {
    for (const link of page.links) {
      if (link.isInternal) continue;
      const target = externalTarget(link.href);
      if (!target) continue;
      const from = linkedFrom.get(target);
      if (!from) linkedFrom.set(target, [page.url]);
      // Pages arrive once each, so a repeat can only be the page just added
      else if (from[from.length - 1] !== page.url) from.push(page.url);
    }
  }

  const targets = [...linkedFrom.keys()].sort(
    (a, b) => linkedFrom.get(b)!.length - linkedFrom.get(a)!.length || a.localeCompare(b)
  );
  const toCheck = targets.slice(0, budget.maxUrls);
  if (toCheck.length > 0) onStart?.(toCheck.length);
  const notChecked = new Set(targets.slice(budget.maxUrls));
  const results = new Map<string, UrlInfo>();

  const stop = new AbortController();
  const timer = setTimeout(() => stop.abort(), budget.budgetMs);
  try {
    await Promise.all(
      toCheck.map(async (target) => {
        try {
          results.set(target, await service.status(target, stop.signal));
        } catch (error) {
          if (!(error instanceof RequestAbandonedError)) throw error;
          notChecked.add(target);
        }
      })
    );
  } finally {
    clearTimeout(timer);
  }
  return { enabled: true, results, notChecked, linkedFrom };
}

/** Why a target could not be verified, in words a report can show */
export function unverifiedReason(info: UrlInfo): string {
  if (info.rateLimited) return `rate-limited (HTTP ${info.status})`;
  if (info.status) return `refused (HTTP ${info.status})`;
  if (info.failure === 'timeout') return 'timed out';
  if (info.failure === 'private-address') return 'private address';
  return 'no response';
}

/** What a broken target answered */
export function brokenReason(info: UrlInfo): string {
  if (info.status) return `HTTP ${info.status}`;
  if (info.failure === 'dns') return 'domain does not resolve';
  if (info.failure === 'refused') return 'connection refused';
  return 'no response';
}

export interface ExternalLinksExtras {
  checked: number;
  broken: number;
  couldNotVerify: number;
  notChecked: number;
  /** Answered from the persisted link cache */
  fromCache: number;
  brokenTargets: Array<{ url: string; status: number; reason: string; linkedFrom: string[]; linkedFromCount: number }>;
  unverifiedTargets: Array<{ url: string; status: number; reason: string; linkedFromCount: number }>;
}

/** The run-level list a report shows: broken targets and who links to them */
export function externalLinksExtras(check: ExternalLinkCheck): ExternalLinksExtras | undefined {
  if (!check.enabled || check.linkedFrom.size === 0) return undefined;
  const broken: ExternalLinksExtras['brokenTargets'] = [];
  const unverified: ExternalLinksExtras['unverifiedTargets'] = [];
  let fromCache = 0;
  for (const [url, info] of check.results) {
    if (info.cached) fromCache++;
    const pages = check.linkedFrom.get(url) ?? [];
    if (info.verdict === 'broken') {
      broken.push({ url, status: info.status, reason: brokenReason(info), linkedFrom: pages.slice(0, MAX_LISTED_PAGES), linkedFromCount: pages.length });
    } else if (info.verdict !== 'ok') {
      unverified.push({ url, status: info.status, reason: unverifiedReason(info), linkedFromCount: pages.length });
    }
  }
  const byReach = (a: { linkedFromCount: number; url: string }, b: { linkedFromCount: number; url: string }) =>
    b.linkedFromCount - a.linkedFromCount || a.url.localeCompare(b.url);
  broken.sort(byReach);
  unverified.sort(byReach);
  return {
    checked: check.results.size,
    broken: broken.length,
    couldNotVerify: unverified.length,
    notChecked: check.notChecked.size,
    fromCache,
    brokenTargets: broken.slice(0, MAX_LISTED_TARGETS),
    unverifiedTargets: unverified.slice(0, MAX_LISTED_TARGETS),
  };
}
