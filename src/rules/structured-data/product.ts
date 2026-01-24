import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, fail } from '../define-rule.js';
import { findItemsByType, getMissingFields, hasField } from './utils.js';

const PRODUCT_TYPES = ['Product', 'ProductGroup'];
const REQUIRED = ['name', 'image'];
const RECOMMENDED = ['description', 'brand', 'sku', 'gtin', 'aggregateRating', 'review'];
const OFFER_REQUIRED = ['price', 'priceCurrency', 'availability'];

/**
 * Rule: Product Schema
 *
 * Validates Product schema for e-commerce rich results.
 * Checks for required fields and proper offers structure.
 */
export const structuredDataProductRule = defineRule({
  id: 'structured-data-product',
  name: 'Product Schema',
  description: 'Validates Product schema for e-commerce rich results',
  category: 'structured-data',
  weight: 12,
  run: (context: AuditContext) => {
    const { $ } = context;
    const products = findItemsByType($, PRODUCT_TYPES);

    if (products.length === 0) {
      return pass('structured-data-product', 'No Product schema found (not required)', {
        found: false,
      });
    }

    const issues: string[] = [];
    const warnings: string[] = [];

    for (const product of products) {
      const missing = getMissingFields(product, REQUIRED);
      if (missing.length > 0) {
        issues.push(`Product missing: ${missing.join(', ')}`);
      }

      // Validate offers
      if (hasField(product, 'offers')) {
        const offers = product.data.offers;
        const offerList = Array.isArray(offers) ? offers : [offers];

        for (const offer of offerList) {
          if (typeof offer !== 'object' || offer === null) continue;
          const o = offer as Record<string, unknown>;

          for (const field of OFFER_REQUIRED) {
            if (!o[field]) {
              issues.push(`Offer missing ${field}`);
            }
          }

          // Check valid availability values
          if (o.availability) {
            const validAvailability = [
              'InStock', 'OutOfStock', 'PreOrder', 'BackOrder',
              'https://schema.org/InStock', 'https://schema.org/OutOfStock',
              'https://schema.org/PreOrder', 'https://schema.org/BackOrder',
            ];
            const avail = String(o.availability);
            const isValid = validAvailability.some((v) => avail.includes(v.replace('https://schema.org/', '')));
            if (!isValid) {
              warnings.push('availability should use schema.org ItemAvailability values');
            }
          }
        }
      } else {
        issues.push('Product missing offers (required for rich results)');
      }

      const missingRecommended = getMissingFields(product, RECOMMENDED);
      if (missingRecommended.length > 0) {
        warnings.push(`consider adding ${missingRecommended.join(', ')}`);
      }
    }

    if (issues.length > 0) {
      return fail('structured-data-product', issues.slice(0, 3).join('; '), {
        productCount: products.length,
        issues,
        warnings,
      });
    }

    if (warnings.length > 0) {
      return warn('structured-data-product', 'Product schema valid with suggestions', {
        productCount: products.length,
        warnings,
      });
    }

    return pass('structured-data-product', `${products.length} Product schema(s) properly configured`, {
      productCount: products.length,
    });
  },
});
