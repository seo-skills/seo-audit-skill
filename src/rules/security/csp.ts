import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn } from '../define-rule.js';

/**
 * Parse CSP header and extract directive names
 */
function parseCspDirectives(value: string): string[] {
  const directives: string[] = [];
  const parts = value.split(';');

  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed) {
      // Extract directive name (first word before space)
      const directiveName = trimmed.split(/\s+/)[0]?.toLowerCase();
      if (directiveName) {
        directives.push(directiveName);
      }
    }
  }

  return directives;
}

// Important CSP directives to check for
const RECOMMENDED_DIRECTIVES = [
  'default-src',
  'script-src',
  'style-src',
  'img-src',
  'frame-ancestors',
];

/**
 * Rule: Check Content-Security-Policy header is present
 */
export const cspRule = defineRule({
  id: 'security-csp',
  name: 'Content-Security-Policy',
  description: 'Checks that Content-Security-Policy header is present',
  category: 'security',
  weight: 4,
  run: (context: AuditContext) => {
    const { headers, url } = context;

    // Check for CSP header (also check for report-only variant)
    const cspHeader = headers['content-security-policy'];
    const cspReportOnlyHeader = headers['content-security-policy-report-only'];

    // No CSP at all
    if (!cspHeader && !cspReportOnlyHeader) {
      return warn(
        'security-csp',
        'Content-Security-Policy header is missing. Consider adding CSP to prevent XSS attacks.',
        { url }
      );
    }

    // Only report-only mode
    if (!cspHeader && cspReportOnlyHeader) {
      const directives = parseCspDirectives(cspReportOnlyHeader);
      return warn(
        'security-csp',
        'Content-Security-Policy is in report-only mode. Consider enforcing the policy.',
        {
          url,
          mode: 'report-only',
          headerValue: cspReportOnlyHeader,
          directives,
        }
      );
    }

    // CSP is present
    const directives = parseCspDirectives(cspHeader);
    const missingRecommended = RECOMMENDED_DIRECTIVES.filter(
      (d) => !directives.includes(d)
    );

    const details = {
      url,
      headerValue: cspHeader,
      directives,
      missingRecommended,
      hasReportOnly: !!cspReportOnlyHeader,
    };

    if (missingRecommended.length > 0) {
      return warn(
        'security-csp',
        `Content-Security-Policy is present but missing recommended directives: ${missingRecommended.join(', ')}`,
        details
      );
    }

    return pass(
      'security-csp',
      `Content-Security-Policy is properly configured with ${directives.length} directives`,
      details
    );
  },
});
