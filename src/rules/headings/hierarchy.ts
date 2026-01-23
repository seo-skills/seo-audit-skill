import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, fail } from '../define-rule.js';

interface HeadingInfo {
  level: number;
  text: string;
  index: number;
}

/**
 * Rule: Check heading hierarchy (h1 before h2 before h3, no skipped levels)
 */
export const hierarchyRule = defineRule({
  id: 'headings-hierarchy',
  name: 'Heading Hierarchy',
  description:
    'Checks that headings follow proper hierarchy (h1 before h2 before h3) with no skipped levels',
  category: 'headings',
  weight: 1,
  run: async (context: AuditContext) => {
    const { $ } = context;
    const headings: HeadingInfo[] = [];

    // Collect all headings in document order
    $('h1, h2, h3, h4, h5, h6').each((index, el) => {
      const tagName = el.tagName?.toLowerCase() || '';
      const level = parseInt(tagName.replace('h', ''), 10);
      const text = $(el).text().trim();
      headings.push({ level, text, index });
    });

    if (headings.length === 0) {
      return fail('headings-hierarchy', 'No headings found in the document', {
        headingCount: 0,
      });
    }

    const issues: string[] = [];

    // Check if the first heading is an h1
    if (headings[0].level !== 1) {
      issues.push(
        `Document should start with an <h1>, but starts with <h${headings[0].level}>`
      );
    }

    // Check for skipped levels
    for (let i = 1; i < headings.length; i++) {
      const current = headings[i];
      const previous = headings[i - 1];

      // If going deeper in hierarchy, check for skipped levels
      if (current.level > previous.level) {
        const skip = current.level - previous.level;
        if (skip > 1) {
          issues.push(
            `Skipped heading level: <h${previous.level}> followed by <h${current.level}> (missing h${previous.level + 1})`
          );
        }
      }
    }

    const headingStructure = headings.map((h) => ({
      level: h.level,
      text: h.text.substring(0, 50) + (h.text.length > 50 ? '...' : ''),
    }));

    if (issues.length > 0) {
      return warn(
        'headings-hierarchy',
        `Heading hierarchy issues found: ${issues.length} problem(s)`,
        {
          issues,
          headingCount: headings.length,
          structure: headingStructure,
        }
      );
    }

    return pass(
      'headings-hierarchy',
      'Heading hierarchy is correct',
      {
        headingCount: headings.length,
        structure: headingStructure,
      }
    );
  },
});
