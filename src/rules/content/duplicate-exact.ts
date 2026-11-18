import type { AuditContext, RuleOptionValues } from '../../types.js';
import { defineRule, pass, fail, notMeasured, readRuleOptions } from '../define-rule.js';
import {
  ELIGIBILITY_RULE_OPTIONS,
  duplicatesOf,
  eligibilityFrom,
  listedUrls,
  pageEligibility,
} from '../../site/groups.js';

/**
 * Rule: Detect exact duplicate content across crawled pages
 *
 * Exact duplicate content across multiple URLs confuses search engines
 * about which page to index and rank. It dilutes link equity and can
 * result in the wrong page appearing in search results. Compares a hash of
 * each eligible page's visible text; every page in a duplicate group is
 * flagged.
 */
export const duplicateExactRule = defineRule({
  id: 'content-duplicate-exact',
  name: 'Exact Duplicate Content',
  description: 'Detects exact duplicate content across crawled pages using content hashing',
  category: 'content',
  weight: 8,
  options: ELIGIBILITY_RULE_OPTIONS,
  run: async (context: AuditContext, options?: RuleOptionValues) => {
    const { url } = context;
    const eligibility = eligibilityFrom(readRuleOptions(duplicateExactRule, options));

    if (!context.site?.pages) {
      return notMeasured(
        'content-duplicate-exact',
        'Duplicate content detection needs other pages to compare against - run with --crawl',
        undefined,
        'needs-crawl'
      );
    }

    const eligible = pageEligibility(context.site, url, eligibility);
    if (!eligible.eligible) {
      return notMeasured('content-duplicate-exact', `Not compared: ${eligible.reason}`, undefined, 'not-compared');
    }

    const others = duplicatesOf(context.site, url, 'exactContent', eligibility);
    if (others === undefined) {
      return pass('content-duplicate-exact', 'Page has insufficient content for duplicate detection', {
        url,
        reason: 'skipped',
      });
    }

    if (others.length > 0) {
      const listed = listedUrls(others);
      return fail(
        'content-duplicate-exact',
        `Exact duplicate content detected on ${others.length + 1} pages (matches ${others[0]})`,
        {
          url,
          duplicateOf: others[0],
          duplicateUrls: listed.urls,
          duplicateCount: listed.total,
          impact: 'Exact duplicate content confuses search engines about which page to rank and dilutes link equity',
          recommendation:
            'Consolidate duplicate pages using canonical tags, 301 redirects, or by removing the duplicate. Ensure each URL serves unique content.',
        }
      );
    }

    return pass('content-duplicate-exact', 'Content is unique (no exact duplicates detected)', { url });
  },
});
