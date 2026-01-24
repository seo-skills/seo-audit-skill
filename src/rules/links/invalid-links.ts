import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn } from '../define-rule.js';

/**
 * Rule: Check for invalid links
 *
 * Invalid links include empty hrefs, javascript: pseudo-URLs, and
 * malformed URLs that can't be parsed. These indicate poor code quality
 * and can hurt accessibility and crawlability.
 */
export const invalidLinksRule = defineRule({
  id: 'links-invalid',
  name: 'No Invalid Links',
  description: 'Checks for empty, javascript:, or malformed link hrefs',
  category: 'links',
  weight: 1,
  run: (context: AuditContext) => {
    const { invalidLinks } = context;

    if (invalidLinks.length === 0) {
      return pass(
        'links-invalid',
        'No invalid links found',
        { invalidCount: 0 }
      );
    }

    // Group by reason
    const byReason = invalidLinks.reduce(
      (acc, link) => {
        acc[link.reason] = (acc[link.reason] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const issues: string[] = [];
    if (byReason.empty) {
      issues.push(`${byReason.empty} empty href(s)`);
    }
    if (byReason.javascript) {
      issues.push(`${byReason.javascript} javascript: link(s)`);
    }
    if (byReason.malformed) {
      issues.push(`${byReason.malformed} malformed URL(s)`);
    }

    return warn(
      'links-invalid',
      `Found ${invalidLinks.length} invalid link(s): ${issues.join(', ')}`,
      {
        invalidCount: invalidLinks.length,
        byReason,
        invalidLinks: invalidLinks.slice(0, 10).map((l) => ({
          href: l.href,
          reason: l.reason,
          text: l.text,
        })),
        recommendation:
          'Replace javascript: links with buttons, fix malformed URLs, add proper hrefs to empty links',
      }
    );
  },
});
