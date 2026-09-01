import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, notMeasured } from '../define-rule.js';

/**
 * Rule: Check for Trusted Types enforcement in CSP
 *
 * Only graded on sites that already ship a CSP. Trusted Types is a hardening
 * step for policies that exist; reporting it against sites with no CSP at all
 * would repeat what `security-csp` already says.
 */
export const trustedTypesRule = defineRule({
  id: 'security-trusted-types',
  name: 'Trusted Types',
  description:
    'Checks that the Content-Security-Policy requires Trusted Types for DOM XSS sinks',
  category: 'security',
  weight: 2,
  run: (context: AuditContext) => {
    const { headers, url } = context;

    const header =
      headers['content-security-policy'] ?? headers['content-security-policy-report-only'];

    if (!header) {
      return notMeasured(
        'security-trusted-types',
        'No Content-Security-Policy, so Trusted Types cannot be enforced yet',
        { url }
      );
    }

    const normalized = header.toLowerCase();
    const requiresTrustedTypes = normalized.includes('require-trusted-types-for');
    const details = {
      url,
      requiresTrustedTypes,
      hasTrustedTypesDirective: normalized.includes('trusted-types'),
    };

    if (!requiresTrustedTypes) {
      return warn(
        'security-trusted-types',
        "Content-Security-Policy does not set require-trusted-types-for 'script', which would block DOM-based XSS sinks.",
        details
      );
    }

    return pass(
      'security-trusted-types',
      'Content-Security-Policy requires Trusted Types for script sinks',
      details
    );
  },
});
