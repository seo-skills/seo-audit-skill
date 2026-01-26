import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, fail } from '../define-rule.js';

interface HeadingSkip {
  /** Previous heading level */
  from: number;
  /** Current heading level (skipped to) */
  to: number;
  /** Text content of the heading that skipped */
  text: string;
  /** Position in document */
  position: number;
}

/**
 * Rule: Heading Order
 *
 * Checks that heading levels don't skip (e.g., H1 → H3).
 * Proper heading hierarchy is essential for:
 * - Screen reader navigation
 * - Document outline
 * - SEO
 *
 * Valid: H1 → H2 → H3 → H2 → H3
 * Invalid: H1 → H3 (skipped H2)
 */
export const headingOrderRule = defineRule({
  id: 'a11y-heading-order',
  name: 'Heading Order',
  description: 'Checks that heading levels do not skip',
  category: 'a11y',
  weight: 8,
  run: (context: AuditContext) => {
    const { $ } = context;

    const headings: Array<{ level: number; text: string }> = [];
    const skips: HeadingSkip[] = [];

    // Collect all headings in document order
    $('h1, h2, h3, h4, h5, h6').each((_, el) => {
      const tag = el.tagName?.toLowerCase() || 'h1';
      const level = parseInt(tag.charAt(1), 10);
      const text = $(el).text().trim().slice(0, 50);

      headings.push({ level, text });
    });

    if (headings.length === 0) {
      return warn('a11y-heading-order', 'No headings found on page', {
        recommendation: 'Add heading structure for accessibility and SEO',
      });
    }

    // Check for skipped levels
    let previousLevel = 0;

    for (let i = 0; i < headings.length; i++) {
      const { level, text } = headings[i];

      // First heading can be any level (commonly H1)
      if (previousLevel === 0) {
        previousLevel = level;
        continue;
      }

      // Going deeper: should only increase by 1
      if (level > previousLevel && level - previousLevel > 1) {
        skips.push({
          from: previousLevel,
          to: level,
          text,
          position: i + 1,
        });
      }

      previousLevel = level;
    }

    // Check if first heading is not H1
    const firstHeadingNotH1 = headings.length > 0 && headings[0].level !== 1;

    if (skips.length === 0 && !firstHeadingNotH1) {
      return pass('a11y-heading-order', 'Heading hierarchy is correct', {
        totalHeadings: headings.length,
        levels: [...new Set(headings.map((h) => `H${h.level}`))].join(', '),
      });
    }

    const issues: string[] = [];

    if (firstHeadingNotH1) {
      issues.push(`First heading is H${headings[0].level}, should be H1`);
    }

    for (const skip of skips) {
      issues.push(`H${skip.from} → H${skip.to} (skipped H${skip.from + 1}): "${skip.text}"`);
    }

    if (skips.length > 3 || (skips.length > 0 && firstHeadingNotH1)) {
      return fail('a11y-heading-order', `Found ${issues.length} heading hierarchy issue(s)`, {
        issues: issues.slice(0, 10),
        totalHeadings: headings.length,
        skips: skips.slice(0, 5),
      });
    }

    return warn('a11y-heading-order', `Found ${issues.length} heading hierarchy issue(s)`, {
      issues,
      totalHeadings: headings.length,
      skips,
    });
  },
});
