import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn } from '../define-rule.js';
import { findItemsByType, getMissingFields, hasField } from './utils.js';

const ORG_TYPES = ['Organization', 'Corporation', 'NGO', 'GovernmentOrganization'];
const REQUIRED = ['name'];
const RECOMMENDED = ['url', 'logo', 'sameAs', 'contactPoint', 'address'];

/**
 * Rule: Organization Schema
 *
 * Validates Organization schema for brand knowledge panel eligibility.
 * Checks for required name and recommended fields like logo and sameAs.
 */
export const structuredDataOrganizationRule = defineRule({
  id: 'structured-data-organization',
  name: 'Organization Schema',
  description: 'Validates Organization schema for brand knowledge panel eligibility',
  category: 'structured-data',
  weight: 8,
  run: (context: AuditContext) => {
    const { $ } = context;
    const orgs = findItemsByType($, ORG_TYPES);

    if (orgs.length === 0) {
      return pass('structured-data-organization', 'No Organization schema found (not required)', {
        found: false,
      });
    }

    const warnings: string[] = [];

    for (const org of orgs) {
      const missing = getMissingFields(org, REQUIRED);
      if (missing.length > 0) {
        return warn('structured-data-organization', `Organization missing: ${missing.join(', ')}`, {
          orgCount: orgs.length,
          missing,
        });
      }

      // Check logo is proper URL
      if (hasField(org, 'logo')) {
        const logo = org.data.logo;
        if (typeof logo === 'string' && !logo.startsWith('http')) {
          warnings.push('logo should be absolute URL');
        }
      } else {
        warnings.push('consider adding logo for brand visibility');
      }

      // Check sameAs for social profiles
      if (!hasField(org, 'sameAs')) {
        warnings.push('consider adding sameAs with social media profiles');
      }

      const missingRecommended = getMissingFields(org, RECOMMENDED);
      if (missingRecommended.length > 0) {
        warnings.push(`consider adding ${missingRecommended.join(', ')}`);
      }
    }

    if (warnings.length > 0) {
      return warn('structured-data-organization', 'Organization schema valid with suggestions', {
        orgCount: orgs.length,
        warnings,
      });
    }

    return pass('structured-data-organization', `${orgs.length} Organization schema(s) properly configured`, {
      orgCount: orgs.length,
    });
  },
});
