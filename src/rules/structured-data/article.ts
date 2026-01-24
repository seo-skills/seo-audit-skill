import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, fail } from '../define-rule.js';
import { findItemsByType, getMissingFields, hasField } from './utils.js';

const ARTICLE_TYPES = [
  'Article',
  'NewsArticle',
  'BlogPosting',
  'TechArticle',
  'ScholarlyArticle',
];
const REQUIRED = ['headline', 'author', 'datePublished'];
const RECOMMENDED = [
  'image',
  'publisher',
  'dateModified',
  'description',
  'mainEntityOfPage',
];

/**
 * Rule: Validate Article schema structured data
 *
 * Checks for proper implementation of Article-type schemas including:
 * - Required fields: headline, author, datePublished
 * - Recommended fields: image, publisher, dateModified, description, mainEntityOfPage
 * - Author format: should be Person/Organization object, not plain string
 */
export const structuredDataArticleRule = defineRule({
  id: 'structured-data-article',
  name: 'Article Schema',
  description:
    'Validates Article, NewsArticle, BlogPosting, TechArticle, and ScholarlyArticle schemas for required and recommended fields',
  category: 'structured-data',
  weight: 12,
  run: async (context: AuditContext) => {
    const { $ } = context;

    const articles = findItemsByType($, ARTICLE_TYPES);

    if (articles.length === 0) {
      return pass(
        'structured-data-article',
        'No Article schema found (not required)',
        { articlesFound: 0 }
      );
    }

    const issues: string[] = [];
    const warnings: string[] = [];

    for (const article of articles) {
      const articleType = article.type;

      // Check required fields
      const missingRequired = getMissingFields(article, REQUIRED);
      if (missingRequired.length > 0) {
        issues.push(
          `${articleType}: missing required fields: ${missingRequired.join(', ')}`
        );
      }

      // Check if author is a string instead of Person/Organization object
      if (hasField(article, 'author')) {
        const author = article.data.author;
        if (typeof author === 'string') {
          warnings.push(
            `${articleType}: author should be a Person or Organization object, not a plain string`
          );
        }
      }

      // Check recommended fields
      const missingRecommended = getMissingFields(article, RECOMMENDED);
      if (missingRecommended.length > 0) {
        warnings.push(
          `${articleType}: missing recommended fields: ${missingRecommended.join(', ')}`
        );
      }
    }

    if (issues.length > 0) {
      return fail(
        'structured-data-article',
        `Article schema validation failed: ${issues.join('; ')}`,
        {
          articlesFound: articles.length,
          issues,
          warnings,
        }
      );
    }

    if (warnings.length > 0) {
      return warn(
        'structured-data-article',
        `Article schema has warnings: ${warnings.join('; ')}`,
        {
          articlesFound: articles.length,
          warnings,
        }
      );
    }

    return pass(
      'structured-data-article',
      `All ${articles.length} Article schema(s) have required fields`,
      {
        articlesFound: articles.length,
        articleTypes: articles.map((a) => a.type),
      }
    );
  },
});
