import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn } from '../define-rule.js';

/**
 * Rule: Validate tel: and mailto: links
 *
 * Phone and email links should have valid formats to ensure they work
 * correctly when clicked. Invalid formats can frustrate users.
 */
export const telMailtoRule = defineRule({
  id: 'links-tel-mailto',
  name: 'Valid Tel & Mailto Links',
  description: 'Checks that tel: and mailto: links have valid formats',
  category: 'links',
  weight: 1,
  run: (context: AuditContext) => {
    const { specialLinks } = context;

    if (specialLinks.length === 0) {
      return pass(
        'links-tel-mailto',
        'No tel: or mailto: links found',
        { totalSpecialLinks: 0 }
      );
    }

    const invalidLinks = specialLinks.filter((link) => !link.isValid);

    if (invalidLinks.length === 0) {
      const telCount = specialLinks.filter((l) => l.type === 'tel').length;
      const mailtoCount = specialLinks.filter((l) => l.type === 'mailto').length;

      return pass(
        'links-tel-mailto',
        `All ${specialLinks.length} tel:/mailto: link(s) have valid formats`,
        {
          totalSpecialLinks: specialLinks.length,
          telCount,
          mailtoCount,
        }
      );
    }

    // Group by type
    const invalidTel = invalidLinks.filter((l) => l.type === 'tel');
    const invalidMailto = invalidLinks.filter((l) => l.type === 'mailto');

    const issues: string[] = [];
    if (invalidTel.length > 0) {
      issues.push(`${invalidTel.length} invalid phone number(s)`);
    }
    if (invalidMailto.length > 0) {
      issues.push(`${invalidMailto.length} invalid email(s)`);
    }

    return warn(
      'links-tel-mailto',
      `Found ${invalidLinks.length} invalid special link(s): ${issues.join(', ')}`,
      {
        totalSpecialLinks: specialLinks.length,
        invalidCount: invalidLinks.length,
        invalidTelCount: invalidTel.length,
        invalidMailtoCount: invalidMailto.length,
        invalidLinks: invalidLinks.slice(0, 10).map((l) => ({
          type: l.type,
          href: l.href,
          value: l.value,
          issue: l.issue,
          text: l.text,
        })),
        recommendation:
          'Use E.164 format for phone numbers (+1234567890), use valid email format for mailto',
      }
    );
  },
});
