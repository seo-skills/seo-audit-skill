import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, fail } from '../define-rule.js';

/**
 * Rule: TLS/SSL Protocol Configuration
 *
 * Evaluates the TLS configuration quality through HTTP response header
 * indicators. Checks for HSTS with recommended directives (includeSubDomains,
 * preload) and CSP upgrade-insecure-requests, which together indicate a
 * well-configured TLS deployment.
 *
 * A complete HSTS configuration with includeSubDomains and preload provides
 * the strongest protection against protocol downgrade attacks.
 */
export const sslProtocolRule = defineRule({
  id: 'security-ssl-protocol',
  name: 'TLS Protocol Configuration',
  description: 'Checks TLS configuration quality through HSTS directives and security header indicators',
  category: 'security',
  weight: 6,
  run: (context: AuditContext) => {
    const { headers, url } = context;

    // Only relevant for HTTPS sites
    if (!url.startsWith('https://')) {
      return fail(
        'security-ssl-protocol',
        'Page is served over HTTP; TLS configuration check not applicable',
        {
          isHttps: false,
          recommendation: 'Migrate to HTTPS to enable TLS protection',
        }
      );
    }

    const hstsHeader = headers['strict-transport-security'] || '';
    const cspHeader = headers['content-security-policy'] || '';

    // No HSTS at all on an HTTPS site
    if (!hstsHeader) {
      return fail(
        'security-ssl-protocol',
        'No Strict-Transport-Security header on HTTPS site; browsers cannot enforce secure connections',
        {
          isHttps: true,
          hasHsts: false,
          recommendation: 'Add Strict-Transport-Security: max-age=31536000; includeSubDomains; preload',
        }
      );
    }

    // Parse HSTS directives
    const hstsLower = hstsHeader.toLowerCase();
    const hasIncludeSubDomains = hstsLower.includes('includesubdomains');
    const hasPreload = hstsLower.includes('preload');
    const hasUpgradeInsecureRequests = cspHeader.toLowerCase().includes('upgrade-insecure-requests');

    const details = {
      isHttps: true,
      hasHsts: true,
      hstsHeader,
      hasIncludeSubDomains,
      hasPreload,
      hasUpgradeInsecureRequests,
    };

    // Full configuration: HSTS + includeSubDomains + preload
    if (hasIncludeSubDomains && hasPreload) {
      return pass(
        'security-ssl-protocol',
        'TLS configuration is robust: HSTS with includeSubDomains and preload enabled',
        details
      );
    }

    // Partial configuration
    const missing: string[] = [];
    if (!hasIncludeSubDomains) {
      missing.push('includeSubDomains');
    }
    if (!hasPreload) {
      missing.push('preload');
    }

    return warn(
      'security-ssl-protocol',
      `HSTS is present but missing ${missing.join(' and ')}; full protection requires both directives`,
      {
        ...details,
        missingDirectives: missing,
        recommendation: `Add ${missing.join(' and ')} to the Strict-Transport-Security header for complete TLS enforcement`,
      }
    );
  },
});
