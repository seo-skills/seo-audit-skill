import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn } from '../define-rule.js';

interface DuplicateInfo {
  text: string;
  count: number;
  levels: number[];
}

/**
 * Rule: Check heading text is unique (warn if duplicates)
 */
export const contentUniqueRule = defineRule({
  id: 'headings-content-unique',
  name: 'Unique Heading Content',
  description: 'Checks that heading text is unique across the document',
  category: 'headings',
  weight: 1,
  run: async (context: AuditContext) => {
    const { $ } = context;
    const headingTexts: Map<string, { count: number; levels: number[] }> =
      new Map();

    $('h1, h2, h3, h4, h5, h6').each((_, el) => {
      const tagName = el.tagName?.toLowerCase() || '';
      const level = parseInt(tagName.replace('h', ''), 10);
      const text = $(el).text().trim().toLowerCase();

      if (text) {
        const existing = headingTexts.get(text);
        if (existing) {
          existing.count++;
          existing.levels.push(level);
        } else {
          headingTexts.set(text, { count: 1, levels: [level] });
        }
      }
    });

    if (headingTexts.size === 0) {
      return pass('headings-content-unique', 'No headings found to check', {
        headingCount: 0,
      });
    }

    const duplicates: DuplicateInfo[] = [];
    headingTexts.forEach((info, text) => {
      if (info.count > 1) {
        duplicates.push({
          text: text.substring(0, 50) + (text.length > 50 ? '...' : ''),
          count: info.count,
          levels: info.levels,
        });
      }
    });

    if (duplicates.length > 0) {
      const totalDuplicates = duplicates.reduce((sum, d) => sum + d.count, 0);
      return warn(
        'headings-content-unique',
        `Found ${duplicates.length} duplicate heading text(s) (${totalDuplicates} total occurrences)`,
        {
          uniqueHeadings: headingTexts.size,
          duplicateCount: duplicates.length,
          duplicates,
        }
      );
    }

    return pass(
      'headings-content-unique',
      `All ${headingTexts.size} headings have unique content`,
      {
        uniqueHeadings: headingTexts.size,
        duplicateCount: 0,
      }
    );
  },
});
