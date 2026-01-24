import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, fail } from '../define-rule.js';
import { findItemsByType, getMissingFields, hasField } from './utils.js';

const LOCAL_TYPES = [
  'LocalBusiness',
  'Restaurant',
  'Store',
  'MedicalBusiness',
  'LegalService',
  'FinancialService',
  'RealEstateAgent',
  'Dentist',
  'Physician',
  'Attorney',
];
const REQUIRED = ['name', 'address'];
const RECOMMENDED = [
  'telephone',
  'openingHours',
  'geo',
  'priceRange',
  'image',
  'url',
];

/**
 * Rule: Validate LocalBusiness schema structured data
 *
 * Checks for proper implementation of LocalBusiness-type schemas including:
 * - Required fields: name, address
 * - Recommended fields: telephone, openingHours, geo, priceRange, image, url
 * - Address format: should be PostalAddress object with streetAddress, addressLocality
 * - Geo format: should have latitude and longitude
 */
export const structuredDataLocalBusinessRule = defineRule({
  id: 'structured-data-local-business',
  name: 'LocalBusiness Schema',
  description:
    'Validates LocalBusiness, Restaurant, Store, and other local business schemas for required and recommended fields',
  category: 'structured-data',
  weight: 10,
  run: async (context: AuditContext) => {
    const { $ } = context;

    const businesses = findItemsByType($, LOCAL_TYPES);

    if (businesses.length === 0) {
      return pass(
        'structured-data-local-business',
        'No LocalBusiness schema found (not required)',
        { businessesFound: 0 }
      );
    }

    const issues: string[] = [];
    const warnings: string[] = [];

    for (const business of businesses) {
      const businessType = business.type;

      // Check required fields
      const missingRequired = getMissingFields(business, REQUIRED);
      if (missingRequired.length > 0) {
        issues.push(
          `${businessType}: missing required fields: ${missingRequired.join(', ')}`
        );
      }

      // Validate address format if present
      if (hasField(business, 'address')) {
        const address = business.data.address;
        if (typeof address === 'string') {
          warnings.push(
            `${businessType}: address should be PostalAddress object, not string`
          );
        } else if (address && typeof address === 'object') {
          const addressObj = address as Record<string, unknown>;
          const missingAddressFields: string[] = [];
          if (!addressObj.streetAddress) {
            missingAddressFields.push('streetAddress');
          }
          if (!addressObj.addressLocality) {
            missingAddressFields.push('addressLocality');
          }
          if (missingAddressFields.length > 0) {
            warnings.push(
              `${businessType}: address missing fields: ${missingAddressFields.join(', ')}`
            );
          }
        }
      }

      // Validate geo format if present
      if (hasField(business, 'geo')) {
        const geo = business.data.geo;
        if (geo && typeof geo === 'object') {
          const geoObj = geo as Record<string, unknown>;
          const missingGeoFields: string[] = [];
          if (geoObj.latitude === undefined || geoObj.latitude === null) {
            missingGeoFields.push('latitude');
          }
          if (geoObj.longitude === undefined || geoObj.longitude === null) {
            missingGeoFields.push('longitude');
          }
          if (missingGeoFields.length > 0) {
            warnings.push(
              `${businessType}: geo missing fields: ${missingGeoFields.join(', ')}`
            );
          }
        }
      }

      // Check recommended fields
      const missingRecommended = getMissingFields(business, RECOMMENDED);
      if (missingRecommended.length > 0) {
        warnings.push(
          `${businessType}: missing recommended fields: ${missingRecommended.join(', ')}`
        );
      }
    }

    if (issues.length > 0) {
      return fail(
        'structured-data-local-business',
        `LocalBusiness schema validation failed: ${issues.join('; ')}`,
        {
          businessesFound: businesses.length,
          issues,
          warnings,
        }
      );
    }

    if (warnings.length > 0) {
      return warn(
        'structured-data-local-business',
        `LocalBusiness schema has warnings: ${warnings.join('; ')}`,
        {
          businessesFound: businesses.length,
          warnings,
        }
      );
    }

    return pass(
      'structured-data-local-business',
      `All ${businesses.length} LocalBusiness schema(s) have required fields`,
      {
        businessesFound: businesses.length,
        businessTypes: businesses.map((b) => b.type),
      }
    );
  },
});
