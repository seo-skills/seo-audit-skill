import type { AuditContext, RuleOptionValues } from '../../types.js';
import { defineRule, pass, warn, fail, notMeasured, readRuleOptions } from '../define-rule.js';
import {
  ELIGIBILITY_RULE_OPTIONS,
  eligibilityFrom,
  listedUrls,
  nearDuplicateAnalysis,
  pageEligibility,
} from '../../site/groups.js';

/** Similarity above which a page fails: near-duplicate content */
const DUPLICATE_THRESHOLD = 0.8;
/** Similarity above which a page warns: similar content */
const SIMILAR_THRESHOLD = 0.6;

/**
 * Rule: Detect near-duplicate content across the crawl
 *
 * Near-duplicate pages compete with each other for the same queries. Each
 * eligible page's main content (its first 500 words) is compared with every
 * other's through MinHash candidate pairs confirmed by exact Jaccard
 * similarity of word trigrams (see `site/near-duplicates.ts`). A page's
 * verdict comes from its most similar page; the finding lists every page
 * above the warning threshold.
 */
export const duplicateNearRule = defineRule({
  id: 'content-duplicate-near',
  name: 'Near-Duplicate Content',
  description: 'Detects near-duplicate content across crawled pages using trigram similarity',
  category: 'content',
  weight: 7,
  options: {
    ...ELIGIBILITY_RULE_OPTIONS,
    fail_threshold: {
      type: 'number',
      default: DUPLICATE_THRESHOLD,
      min: 0.5,
      max: 1,
      description: 'Fail above this similarity (0 to 1)',
    },
    warn_threshold: {
      type: 'number',
      default: SIMILAR_THRESHOLD,
      min: 0.5,
      max: 1,
      description: 'Warn above this similarity (0 to 1)',
    },
  },
  run: async (context: AuditContext, options?: RuleOptionValues) => {
    const { url } = context;
    const opts = readRuleOptions(duplicateNearRule, options);
    const eligibility = eligibilityFrom(opts);
    const failAbove = opts.fail_threshold as number;
    const warnAbove = Math.min(opts.warn_threshold as number, failAbove);

    if (!context.site?.pages) {
      return notMeasured(
        'content-duplicate-near',
        'Near-duplicate detection needs other pages to compare against - run with --crawl',
        undefined,
        'needs-crawl'
      );
    }

    const site = context.site;
    const eligible = pageEligibility(site, url, eligibility);
    if (!eligible.eligible) {
      return notMeasured('content-duplicate-near', `Not compared: ${eligible.reason}`, undefined, 'not-compared');
    }

    const self = site.pages!.get(site.normalize(url));
    if (!self?.shingles || self.shingles.length < 5) {
      return pass('content-duplicate-near', 'Page has insufficient content for near-duplicate detection', {
        url,
        reason: 'skipped',
      });
    }

    const analysis = nearDuplicateAnalysis(site, eligibility, warnAbove);
    if (analysis.kind === 'too-many-candidates') {
      return notMeasured(
        'content-duplicate-near',
        `Too many similar pages to compare (${analysis.candidatePairs.toLocaleString('en-US')} candidate pairs); run a smaller crawl or narrow it with include/exclude`,
        { url },
        'could-not-verify'
      );
    }

    const similar = (analysis.similar.get(site.normalize(url)) ?? []).filter((p) => p.similarity > warnAbove);
    const highest = similar[0];
    const details = {
      url,
      highestSimilarity: highest ? Math.round(highest.similarity * 100) / 100 : 0,
      mostSimilarUrl: highest?.url ?? null,
      similarUrls: listedUrls(similar.map((p) => p.url)).urls,
      similarCount: similar.length,
      thresholds: { duplicate: failAbove, similar: warnAbove },
    };

    if (highest && highest.similarity > failAbove) {
      return fail(
        'content-duplicate-near',
        `Near-duplicate content detected: ${Math.round(highest.similarity * 100)}% similar to ${highest.url}`,
        {
          ...details,
          impact: 'Near-duplicate pages cause keyword cannibalization and confuse search engines about which page to rank',
          recommendation:
            'Consolidate similar pages, differentiate their content significantly, or use canonical tags to indicate the preferred version.',
        }
      );
    }

    if (highest) {
      return warn(
        'content-duplicate-near',
        `Similar content detected: ${Math.round(highest.similarity * 100)}% similar to ${highest.url}`,
        {
          ...details,
          impact: 'Highly similar content may compete with itself in search rankings',
          recommendation:
            'Review both pages and differentiate their content, titles, and meta descriptions to target different search intents.',
        }
      );
    }

    return pass('content-duplicate-near', 'Content is sufficiently unique', details);
  },
});
