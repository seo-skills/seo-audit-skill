import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, fail } from '../define-rule.js';

/**
 * Rule: Check for exactly one main landmark
 *
 * The main landmark is how a screen reader user skips past navigation to the
 * page's actual content. Broader than `a11y-landmark-regions`, which passes if
 * any landmark at all is present.
 */
export const mainLandmarkRule = defineRule({
  id: 'a11y-main-landmark',
  name: 'Main Landmark',
  description: 'Checks that the page has exactly one <main> or role="main" landmark',
  category: 'a11y',
  weight: 5,
  run: (context: AuditContext) => {
    const { $, url } = context;

    // A nested <main> inside a hidden template is still markup the browser
    // exposes, so count what is actually in the document.
    const count = $('main, [role="main"]').length;
    const details = { url, count };

    if (count === 0) {
      return fail(
        'a11y-main-landmark',
        'No main landmark found. Add <main> so users can skip directly to the content.',
        details
      );
    }

    if (count > 1) {
      return warn(
        'a11y-main-landmark',
        `${count} main landmarks found. Exactly one should identify the primary content.`,
        details
      );
    }

    return pass('a11y-main-landmark', 'Page has one main landmark', details);
  },
});
