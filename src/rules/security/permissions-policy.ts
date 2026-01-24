import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn } from '../define-rule.js';

/**
 * Parse Permissions-Policy header and extract feature names.
 * Format: feature1=(allowlist), feature2=(allowlist)
 */
function parsePermissionsPolicy(value: string): string[] {
  const features: string[] = [];
  const matches = value.matchAll(/([a-z-]+)\s*=/gi);
  for (const match of matches) {
    features.push(match[1].toLowerCase());
  }
  return features;
}

/**
 * Rule: Permissions-Policy
 *
 * Checks for Permissions-Policy (formerly Feature-Policy) header.
 * This header controls which browser features are available.
 */
export const permissionsPolicyRule = defineRule({
  id: 'security-permissions-policy',
  name: 'Permissions-Policy',
  description: 'Checks for Permissions-Policy header',
  category: 'security',
  weight: 2,
  run: (context: AuditContext) => {
    const { headers, url } = context;

    // Check for Permissions-Policy or legacy Feature-Policy
    const permissionsPolicy = headers['permissions-policy'];
    const featurePolicy = headers['feature-policy'];

    if (!permissionsPolicy && !featurePolicy) {
      return warn(
        'security-permissions-policy',
        'Permissions-Policy header is missing. Consider adding to control browser features.',
        { url }
      );
    }

    // Using deprecated Feature-Policy
    if (featurePolicy && !permissionsPolicy) {
      const features = parsePermissionsPolicy(featurePolicy);
      return warn(
        'security-permissions-policy',
        'Using deprecated Feature-Policy header. Migrate to Permissions-Policy.',
        {
          url,
          headerName: 'Feature-Policy',
          headerValue: featurePolicy,
          features,
        }
      );
    }

    // Permissions-Policy is present
    const features = parsePermissionsPolicy(permissionsPolicy || '');

    return pass(
      'security-permissions-policy',
      `Permissions-Policy header is set with ${features.length} feature(s)`,
      {
        url,
        headerValue: permissionsPolicy,
        features,
      }
    );
  },
});
