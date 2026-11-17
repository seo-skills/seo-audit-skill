import type { AuditContext, RuleOptionValues } from '../../types.js';
import { defineRule, pass, warn, fail, notMeasured, readRuleOptions } from '../define-rule.js';
import {
  ELIGIBILITY_RULE_OPTIONS,
  duplicatesOf,
  eligibilityFrom,
  listedUrls,
  pageEligibility,
} from '../../site/groups.js';

/**
 * Rule: Check that meta descriptions are unique across the site
 *
 * Compares this page's description with every other crawled page a search
 * engine would index. Every page in a duplicate group is flagged, whatever
 * order the pages are scored in. Duplicate descriptions reduce click-through
 * because search results cannot tell the pages apart.
 */
export const duplicateDescriptionRule = defineRule({
  id: 'content-duplicate-description',
  name: 'Duplicate Description',
  description: 'Checks for duplicate meta descriptions across the site',
  category: 'content',
  weight: 5,
  options: ELIGIBILITY_RULE_OPTIONS,
  run: async (context: AuditContext, options?: RuleOptionValues) => {
    const { $, url } = context;
    const eligibility = eligibilityFrom(readRuleOptions(duplicateDescriptionRule, options));
    const description = $('meta[name="description"]').attr('content')?.trim();

    if (!description) {
      return fail('content-duplicate-description', 'Page has no meta description', {
        description: null,
        url,
        impact: 'Missing meta description reduces control over how the page appears in search results',
        recommendation: 'Add a unique, compelling meta description between 120-160 characters',
      });
    }

    if (!context.site?.pages) {
      return notMeasured(
        'content-duplicate-description',
        'Description uniqueness needs other pages to compare against - run with --crawl',
        undefined,
        'not-applicable'
      );
    }

    const eligible = pageEligibility(context.site, url, eligibility);
    if (!eligible.eligible) {
      return notMeasured(
        'content-duplicate-description',
        `Not compared: ${eligible.reason}`,
        { description },
        'not-compared'
      );
    }

    const others = duplicatesOf(context.site, url, 'description', eligibility) ?? [];
    const tooShort = description.length < 50;

    if (others.length > 0) {
      const listed = listedUrls(others);
      return warn(
        'content-duplicate-description',
        `Duplicate description found on ${others.length + 1} pages${tooShort ? ' (also too short)' : ''}`,
        {
          description,
          length: description.length,
          duplicateUrls: listed.urls,
          duplicateCount: listed.total,
          impact:
            'Duplicate descriptions confuse search engines about which page to display. They also reduce click-through rates by not differentiating pages.',
          recommendation:
            'Create unique, descriptive meta descriptions for each page that accurately summarize the specific content',
        }
      );
    }

    if (tooShort) {
      return warn('content-duplicate-description', 'Meta description is too short', {
        description,
        length: description.length,
        url,
        recommendation: 'Expand description to 120-160 characters for optimal display in search results',
      });
    }

    return pass('content-duplicate-description', 'Meta description is unique', {
      description,
      length: description.length,
      url,
      isOptimalLength: description.length >= 120 && description.length <= 160,
    });
  },
});
