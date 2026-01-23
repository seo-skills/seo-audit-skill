import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, fail } from '../define-rule.js';

/**
 * Valid X-Frame-Options values
 */
const VALID_X_FRAME_OPTIONS = ['deny', 'sameorigin'];

/**
 * Rule: Check X-Frame-Options header
 */
export const xFrameRule = defineRule({
  id: 'security-x-frame-options',
  name: 'X-Frame-Options',
  description: 'Checks that X-Frame-Options header is set to DENY or SAMEORIGIN to prevent clickjacking',
  category: 'security',
  weight: 5,
  run: (context: AuditContext) => {
    const { headers, url } = context;

    const xFrameOptions = headers['x-frame-options'];

    // Also check CSP frame-ancestors as it's the modern replacement
    const cspHeader = headers['content-security-policy'];
    const hasFrameAncestors = cspHeader?.toLowerCase().includes('frame-ancestors');

    const details = {
      url,
      xFrameOptions: xFrameOptions || null,
      hasFrameAncestors,
    };

    // If neither header is present
    if (!xFrameOptions && !hasFrameAncestors) {
      return fail(
        'security-x-frame-options',
        'Neither X-Frame-Options nor CSP frame-ancestors is set. Site is vulnerable to clickjacking.',
        details
      );
    }

    // If CSP frame-ancestors is set but X-Frame-Options is not
    if (!xFrameOptions && hasFrameAncestors) {
      return pass(
        'security-x-frame-options',
        'CSP frame-ancestors directive is set (modern replacement for X-Frame-Options)',
        details
      );
    }

    // X-Frame-Options is present - validate its value
    const normalizedValue = xFrameOptions.toLowerCase().trim();

    // Check for ALLOW-FROM which is deprecated and not widely supported
    if (normalizedValue.startsWith('allow-from')) {
      return warn(
        'security-x-frame-options',
        'X-Frame-Options ALLOW-FROM is deprecated and not supported in modern browsers. Use CSP frame-ancestors instead.',
        { ...details, value: xFrameOptions }
      );
    }

    // Check for valid values
    if (!VALID_X_FRAME_OPTIONS.includes(normalizedValue)) {
      return fail(
        'security-x-frame-options',
        `X-Frame-Options has invalid value "${xFrameOptions}". Should be DENY or SAMEORIGIN.`,
        { ...details, value: xFrameOptions }
      );
    }

    return pass(
      'security-x-frame-options',
      `X-Frame-Options is set to ${xFrameOptions.toUpperCase()}`,
      { ...details, value: xFrameOptions }
    );
  },
});
