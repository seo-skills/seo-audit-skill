import type { AuditContext, RuleOptionValues } from '../../types.js';
import { defineRule, pass, warn, notMeasured, readRuleOptions } from '../define-rule.js';
import { ELIGIBILITY_RULE_OPTIONS, duplicatesOf, eligibilityFrom, listedUrls, pageEligibility } from '../../site/groups.js';

const ID = 'social-duplicate-og';

/**
 * Rule: og:title and og:description differ between pages
 *
 * When several pages share one share title or description, links to them
 * look identical in a feed. Compared over the whole crawl, among pages a
 * search engine would index, like the duplicate title and description rules.
 */
export const duplicateOgRule = defineRule({
  id: ID,
  name: 'Unique Share Title and Description',
  description: 'Checks that og:title and og:description are not shared by other crawled pages',
  category: 'social',
  weight: 3,
  advisory: true,
  options: { ...ELIGIBILITY_RULE_OPTIONS },
  run: (context: AuditContext, options?: RuleOptionValues) => {
    const site = context.site;
    if (!site?.pages) {
      return notMeasured(ID, 'Needs other pages to compare against - run with --crawl', undefined, 'needs-crawl');
    }
    const eligibility = eligibilityFrom(readRuleOptions(duplicateOgRule, options));
    const eligible = pageEligibility(site, context.url, eligibility);
    if (!eligible.eligible) {
      return notMeasured(ID, `Not compared: ${eligible.reason}`, undefined, 'not-compared');
    }

    const self = site.pages.get(site.normalize(context.url));
    if (!self?.ogTitle && !self?.ogDescription) {
      return notMeasured(ID, 'No og:title or og:description on this page', undefined, 'not-applicable');
    }
    const sameTitle = self.ogTitle ? (duplicatesOf(site, context.url, 'ogTitle', eligibility) ?? []) : [];
    const sameDescription = self.ogDescription ? (duplicatesOf(site, context.url, 'ogDescription', eligibility) ?? []) : [];
    if (sameTitle.length === 0 && sameDescription.length === 0) {
      return pass(ID, 'og:title and og:description are unique across the crawl');
    }
    const parts = [
      sameTitle.length > 0 ? `og:title is shared with ${sameTitle.length} other page(s)` : '',
      sameDescription.length > 0 ? `og:description is shared with ${sameDescription.length} other page(s)` : '',
    ].filter(Boolean);
    return warn(ID, parts.join('; '), {
      ...(sameTitle.length > 0 && { ogTitle: self.ogTitle, sameTitleUrls: listedUrls(sameTitle).urls }),
      ...(sameDescription.length > 0 && { ogDescription: self.ogDescription, sameDescriptionUrls: listedUrls(sameDescription).urls }),
      recommendation: 'Write a share title and description for each page.',
    });
  },
});
