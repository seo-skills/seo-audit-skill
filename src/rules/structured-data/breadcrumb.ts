import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn } from '../define-rule.js';
import { findItemsByType, hasField } from './utils.js';

/**
 * Rule: Validate BreadcrumbList schema structured data
 *
 * Checks for proper implementation of BreadcrumbList schema:
 * - Homepage: breadcrumb not required
 * - Non-homepage: should have BreadcrumbList schema
 * - If present: must have itemListElement with at least 2 items
 */
export const structuredDataBreadcrumbRule = defineRule({
  id: 'structured-data-breadcrumb',
  name: 'Breadcrumb Schema',
  description:
    'Validates BreadcrumbList schema presence on non-homepage pages and checks for proper itemListElement structure',
  category: 'structured-data',
  weight: 8,
  run: async (context: AuditContext) => {
    const { $, url } = context;

    // Check if current URL is homepage
    const parsedUrl = new URL(url);
    const pathname = parsedUrl.pathname;
    const isHomepage = pathname === '/' || pathname === '';

    // Find BreadcrumbList schemas
    const breadcrumbs = findItemsByType($, 'BreadcrumbList');

    // No breadcrumb found
    if (breadcrumbs.length === 0) {
      if (isHomepage) {
        return pass(
          'structured-data-breadcrumb',
          'Homepage - breadcrumb not required',
          { isHomepage: true, breadcrumbsFound: 0 }
        );
      }

      return warn(
        'structured-data-breadcrumb',
        'Non-homepage missing BreadcrumbList schema',
        { isHomepage: false, breadcrumbsFound: 0, pathname }
      );
    }

    // Validate breadcrumb structure
    const issues: string[] = [];

    for (const breadcrumb of breadcrumbs) {
      // Check itemListElement exists
      if (!hasField(breadcrumb, 'itemListElement')) {
        issues.push('BreadcrumbList missing itemListElement');
        continue;
      }

      // Check itemListElement has at least 2 items
      const itemListElement = breadcrumb.data.itemListElement;
      if (Array.isArray(itemListElement)) {
        if (itemListElement.length < 2) {
          issues.push(
            `BreadcrumbList should have at least 2 items, found ${itemListElement.length}`
          );
        }
      } else {
        issues.push('itemListElement should be an array');
      }
    }

    if (issues.length > 0) {
      return warn(
        'structured-data-breadcrumb',
        `BreadcrumbList validation issues: ${issues.join('; ')}`,
        {
          breadcrumbsFound: breadcrumbs.length,
          issues,
          isHomepage,
        }
      );
    }

    return pass(
      'structured-data-breadcrumb',
      `Valid BreadcrumbList schema found with proper structure`,
      {
        breadcrumbsFound: breadcrumbs.length,
        isHomepage,
      }
    );
  },
});
