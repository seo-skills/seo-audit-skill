import type { AuditContext, SiteContext } from '../../types.js';
import { defineRule, pass, warn, notMeasured } from '../define-rule.js';
import { pageEligibility } from '../../site/groups.js';
import { describeSitemapGaps } from '../../crawler/sitemap.js';

const ID = 'crawl-indexable-not-in-sitemap';

/** The sitemap's URLs in the site's key form, built once per crawl */
const listedCache = new WeakMap<SiteContext, { sitemapUrls: string[]; listed: Set<string> }>();

function listed(site: SiteContext, sitemapUrls: string[]): Set<string> {
  const cached = listedCache.get(site);
  if (cached && cached.sitemapUrls === sitemapUrls) return cached.listed;
  const set = new Set<string>();
  for (const url of sitemapUrls) {
    try {
      set.add(site.normalize(url));
    } catch {
      // A malformed sitemap URL lists nothing
    }
  }
  listedCache.set(site, { sitemapUrls, listed: set });
  return set;
}

/**
 * Rule: a page search engines can index is in the sitemap
 *
 * The reverse of crawl-sitemap-orphan-urls. A page that returns 200, is
 * indexable, names itself as canonical and is not a later page of a series
 * is one the site wants found; leaving it out of the sitemap leaves its
 * discovery to links alone.
 */
export const indexableNotInSitemapRule = defineRule({
  id: ID,
  name: 'Indexable Page In Sitemap',
  description: 'Checks that crawled pages search engines can index are listed in the XML sitemap',
  category: 'crawl',
  weight: 5,
  advisory: true,
  run: (context: AuditContext) => {
    const site = context.site;
    if (!site?.pages) {
      return notMeasured(ID, 'Needs a crawl to compare pages with the sitemap - run with --crawl', undefined, 'not-applicable');
    }
    const sitemapUrls = context.sitemapUrls ?? [];
    if (sitemapUrls.length === 0) {
      return notMeasured(ID, 'No sitemap was found (technical-sitemap-exists reports it)', undefined, 'not-applicable');
    }
    // A page in a sitemap that was never read would be flagged wrongly
    if (context.sitemapComplete === false || (context.sitemapSkippedCount ?? 0) > 0) {
      const why = describeSitemapGaps(context.sitemapGaps ?? []) || `${context.sitemapSkippedCount} sitemaps were not read`;
      return notMeasured(ID, `The sitemap could not be read in full (${why})`, undefined, 'could-not-verify');
    }
    const eligible = pageEligibility(site, context.url);
    if (!eligible.eligible) {
      return notMeasured(ID, `Not checked: ${eligible.reason}`, undefined, 'not-compared');
    }

    if (listed(site, sitemapUrls).has(site.normalize(context.url))) {
      return pass(ID, 'The page is listed in the sitemap');
    }
    return warn(ID, 'An indexable page is missing from the sitemap', {
      url: context.url,
      recommendation: 'Add the page to the XML sitemap, or noindex it if it should not be found.',
    });
  },
});
