import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn } from '../define-rule.js';

/**
 * COOP values that actually isolate the browsing context group.
 * `unsafe-none` is the default and provides no isolation.
 */
const ISOLATING_VALUES = ['same-origin', 'same-origin-allow-popups'];

/**
 * Rule: Check Cross-Origin-Opener-Policy header
 *
 * Without COOP, any page that opens this one keeps a handle on its window and
 * shares a browsing context group with it, which is the basis of cross-window
 * attacks such as tabnabbing.
 */
export const coopRule = defineRule({
  id: 'security-coop',
  name: 'Cross-Origin-Opener-Policy',
  description:
    'Checks that Cross-Origin-Opener-Policy isolates the page from windows that open it',
  category: 'security',
  weight: 3,
  run: (context: AuditContext) => {
    const { headers, url } = context;

    const coop = headers['cross-origin-opener-policy']?.trim();
    // The header may carry a reporting group after a semicolon.
    const value = coop?.split(';')[0]?.trim().toLowerCase();
    const details = { url, value: coop ?? null };

    if (!value) {
      return warn(
        'security-coop',
        'Missing Cross-Origin-Opener-Policy header. Pages that open this one keep a reference to its window.',
        details
      );
    }

    if (value === 'unsafe-none') {
      return warn(
        'security-coop',
        'Cross-Origin-Opener-Policy is "unsafe-none", which is the default and provides no isolation.',
        details
      );
    }

    if (!ISOLATING_VALUES.includes(value)) {
      return warn(
        'security-coop',
        `Cross-Origin-Opener-Policy has unrecognised value "${coop}". Expected same-origin or same-origin-allow-popups.`,
        details
      );
    }

    return pass('security-coop', `Cross-Origin-Opener-Policy is "${value}"`, details);
  },
});
