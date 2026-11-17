import type { AuditContext, RuleOptionValues } from '../../types.js';
import { defineRule, pass, warn, fail, notMeasured, readRuleOptions } from '../define-rule.js';
import { DOCUMENT_TITLE } from '../document-title.js';
import {
  ELIGIBILITY_RULE_OPTIONS,
  duplicatesOf,
  eligibilityFrom,
  listedUrls,
  pageEligibility,
} from '../../site/groups.js';

/**
 * Rule: Check that page titles are unique across the site
 *
 * Compares this page's title with every other crawled page that a search
 * engine would index: status 200, not noindex, self-canonical, not a later
 * page of a series. Every page in a duplicate group is flagged, whatever
 * order the pages are scored in.
 */
export const titleUniqueRule = defineRule({
  id: 'core-title-unique',
  name: 'Title Uniqueness',
  description: 'Checks that page titles are unique across the site',
  category: 'core',
  weight: 5,
  options: ELIGIBILITY_RULE_OPTIONS,
  run: async (context: AuditContext, options?: RuleOptionValues) => {
    const { $, url } = context;
    const eligibility = eligibilityFrom(readRuleOptions(titleUniqueRule, options));

    const title = $(DOCUMENT_TITLE).first().text()?.trim();
    if (!title) {
      return fail('core-title-unique', 'Page has no title tag', { title: null, url });
    }

    if (!context.site?.pages) {
      return notMeasured(
        'core-title-unique',
        'Title uniqueness needs other pages to compare against - run with --crawl',
        undefined,
        'not-applicable'
      );
    }

    const eligible = pageEligibility(context.site, url, eligibility);
    if (!eligible.eligible) {
      return notMeasured('core-title-unique', `Not compared: ${eligible.reason}`, { title }, 'not-compared');
    }

    const others = duplicatesOf(context.site, url, 'title', eligibility) ?? [];
    if (others.length > 0) {
      const listed = listedUrls(others);
      return warn('core-title-unique', `Duplicate title found on ${others.length + 1} pages`, {
        title,
        duplicateUrls: listed.urls,
        duplicateCount: listed.total,
        impact: 'Duplicate titles confuse search engines about which page to prioritize',
        recommendation: 'Create unique, descriptive titles for each page (e.g., "Page Topic | Brand Name")',
      });
    }

    return pass('core-title-unique', 'Page title is unique', { title, url });
  },
});
