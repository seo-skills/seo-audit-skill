import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn } from '../define-rule.js';
import type { CheerioAPI } from 'cheerio';
import { findItemsByType, hasField } from './utils.js';

type BreadcrumbSyntax = 'JSON-LD' | 'RDFa' | 'microdata';

interface FoundBreadcrumb {
  syntax: BreadcrumbSyntax;
  /** Number of itemListElement entries */
  itemCount: number;
  /** Why itemListElement cannot be counted, when it cannot */
  problem?: string;
}

/**
 * BreadcrumbLists declared in the markup itself. RDFa and microdata are both
 * valid for breadcrumbs (Google documents all three syntaxes), and
 * developer.mozilla.org uses RDFa.
 */
function markupBreadcrumb(syntax: BreadcrumbSyntax, itemCount: number): FoundBreadcrumb {
  return itemCount === 0
    ? { syntax, itemCount, problem: `BreadcrumbList (${syntax}) missing itemListElement` }
    : { syntax, itemCount };
}

function findMarkupBreadcrumbs($: CheerioAPI): FoundBreadcrumb[] {
  const found: FoundBreadcrumb[] = [];
  $('[typeof~="BreadcrumbList"]').each((_, el) => {
    found.push(markupBreadcrumb('RDFa', $(el).find('[property~="itemListElement"]').length));
  });
  $('[itemscope][itemtype$="/BreadcrumbList"]').each((_, el) => {
    found.push(markupBreadcrumb('microdata', $(el).find('[itemprop~="itemListElement"]').length));
  });
  return found;
}

/**
 * Rule: Validate BreadcrumbList schema structured data
 *
 * Checks for proper implementation of BreadcrumbList schema:
 * - Homepage: breadcrumb not required
 * - Non-homepage: should have BreadcrumbList schema
 * - If present: must have itemListElement with at least 2 items
 */
export const structuredDataBreadcrumbRule = defineRule({
  id: 'schema-breadcrumb',
  name: 'Breadcrumb Schema',
  description:
    'Validates BreadcrumbList schema presence on non-homepage pages and checks for proper itemListElement structure',
  category: 'schema',
  weight: 8,
  run: async (context: AuditContext) => {
    const { $, url } = context;

    // Check if current URL is homepage
    const parsedUrl = new URL(url);
    const pathname = parsedUrl.pathname;
    const isHomepage = pathname === '/' || pathname === '';

    // Find BreadcrumbList schemas, in every syntax a search engine reads
    const breadcrumbs: FoundBreadcrumb[] = [
      ...findItemsByType($, 'BreadcrumbList').map((item): FoundBreadcrumb => {
        if (!hasField(item, 'itemListElement')) {
          return { syntax: 'JSON-LD', itemCount: 0, problem: 'BreadcrumbList missing itemListElement' };
        }
        const itemListElement = item.data.itemListElement;
        return Array.isArray(itemListElement)
          ? { syntax: 'JSON-LD', itemCount: itemListElement.length }
          : { syntax: 'JSON-LD', itemCount: 0, problem: 'itemListElement should be an array' };
      }),
      ...findMarkupBreadcrumbs($),
    ];

    // No breadcrumb found
    if (breadcrumbs.length === 0) {
      if (isHomepage) {
        return pass(
          'schema-breadcrumb',
          'Homepage - breadcrumb not required',
          { isHomepage: true, breadcrumbsFound: 0 }
        );
      }

      return warn(
        'schema-breadcrumb',
        'Non-homepage missing BreadcrumbList schema',
        { isHomepage: false, breadcrumbsFound: 0, pathname }
      );
    }

    const syntax = [...new Set(breadcrumbs.map((breadcrumb) => breadcrumb.syntax))];

    // Validate breadcrumb structure
    const issues: string[] = [];

    for (const breadcrumb of breadcrumbs) {
      if (breadcrumb.problem) {
        issues.push(breadcrumb.problem);
      } else if (breadcrumb.itemCount < 2) {
        issues.push(
          `BreadcrumbList should have at least 2 items, found ${breadcrumb.itemCount}`
        );
      }
    }

    if (issues.length > 0) {
      return warn(
        'schema-breadcrumb',
        `BreadcrumbList validation issues: ${issues.join('; ')}`,
        {
          breadcrumbsFound: breadcrumbs.length,
          syntax,
          issues,
          isHomepage,
        }
      );
    }

    return pass(
      'schema-breadcrumb',
      `Valid BreadcrumbList schema found with proper structure (${syntax.join(', ')})`,
      {
        breadcrumbsFound: breadcrumbs.length,
        syntax,
        isHomepage,
      }
    );
  },
});
