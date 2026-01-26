import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, fail } from '../define-rule.js';
import { findItemsByType, hasField } from './utils.js';

/**
 * Rule: Review Schema
 *
 * Validates Review and AggregateRating schema for star ratings in search results.
 */
export const structuredDataReviewRule = defineRule({
  id: 'schema-review',
  name: 'Review Schema',
  description: 'Validates Review and AggregateRating schema for star ratings',
  category: 'schema',
  weight: 10,
  run: (context: AuditContext) => {
    const { $ } = context;
    const reviews = findItemsByType($, 'Review');
    const aggregateRatings = findItemsByType($, 'AggregateRating');

    if (reviews.length === 0 && aggregateRatings.length === 0) {
      return pass('schema-review', 'No Review/AggregateRating schema found (not required)', {
        found: false,
      });
    }

    const issues: string[] = [];
    const warnings: string[] = [];

    // Validate Reviews
    for (const review of reviews) {
      if (!hasField(review, 'itemReviewed')) {
        issues.push('Review missing itemReviewed');
      }
      if (!hasField(review, 'author')) {
        issues.push('Review missing author');
      }
      if (!hasField(review, 'reviewRating')) {
        warnings.push('Review should include reviewRating');
      } else {
        const rating = review.data.reviewRating as Record<string, unknown>;
        if (typeof rating === 'object' && rating !== null && !rating.ratingValue) {
          issues.push('reviewRating missing ratingValue');
        }
      }
    }

    // Validate AggregateRatings
    for (const agg of aggregateRatings) {
      if (!hasField(agg, 'ratingValue')) {
        issues.push('AggregateRating missing ratingValue');
      }
      if (!hasField(agg, 'reviewCount') && !hasField(agg, 'ratingCount')) {
        issues.push('AggregateRating should have reviewCount or ratingCount');
      }
      if (!hasField(agg, 'bestRating')) {
        warnings.push('AggregateRating should specify bestRating (default 5)');
      }
    }

    if (issues.length > 0) {
      return fail('schema-review', issues.slice(0, 3).join('; '), {
        reviewCount: reviews.length,
        aggregateRatingCount: aggregateRatings.length,
        issues,
        warnings,
      });
    }

    if (warnings.length > 0) {
      return warn('schema-review', 'Review schema valid with suggestions', {
        reviewCount: reviews.length,
        aggregateRatingCount: aggregateRatings.length,
        warnings,
      });
    }

    return pass('schema-review', 'Review/Rating schema properly configured', {
      reviewCount: reviews.length,
      aggregateRatingCount: aggregateRatings.length,
    });
  },
});
