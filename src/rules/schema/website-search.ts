import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn } from '../define-rule.js';
import { findItemsByType, hasField } from './utils.js';

/**
 * Rule: WebSite Search Schema
 *
 * Checks for WebSite schema with sitelinks searchbox eligibility.
 * Most relevant on homepage where SearchAction enables site search in Google.
 */
export const structuredDataWebsiteSearchRule = defineRule({
  id: 'schema-website-search',
  name: 'WebSite Search Schema',
  description: 'Checks for WebSite schema with sitelinks searchbox eligibility',
  category: 'schema',
  weight: 8,
  run: (context: AuditContext) => {
    const { $, url } = context;

    // Check if this is the homepage
    const urlObj = new URL(url);
    const isHomepage = urlObj.pathname === '/' || urlObj.pathname === '';

    const websites = findItemsByType($, 'WebSite');

    if (websites.length === 0) {
      if (isHomepage) {
        return warn('schema-website-search', 'Homepage missing WebSite schema', {
          isHomepage: true,
          suggestion: 'Add WebSite schema to enable sitelinks searchbox',
        });
      }
      return pass('schema-website-search', 'Non-homepage - WebSite schema not required here', {
        isHomepage: false,
      });
    }

    const issues: string[] = [];
    let hasSearchAction = false;

    for (const site of websites) {
      if (!hasField(site, 'name')) {
        issues.push('WebSite missing name');
      }
      if (!hasField(site, 'url')) {
        issues.push('WebSite missing url');
      }

      // Check for SearchAction
      if (hasField(site, 'potentialAction')) {
        const actions = site.data.potentialAction;
        const actionList = Array.isArray(actions) ? actions : [actions];

        for (const action of actionList) {
          if (typeof action !== 'object' || action === null) continue;
          const a = action as Record<string, unknown>;

          if (a['@type'] === 'SearchAction') {
            hasSearchAction = true;

            if (!a.target) {
              issues.push('SearchAction missing target');
            } else {
              // Target can be string or EntryPoint
              const target = a.target;
              if (typeof target === 'string' && !target.includes('{search_term_string}')) {
                issues.push('SearchAction target should include {search_term_string}');
              } else if (typeof target === 'object' && target !== null) {
                const t = target as Record<string, unknown>;
                const urlTemplate = t.urlTemplate as string;
                if (urlTemplate && !urlTemplate.includes('{search_term_string}')) {
                  issues.push('SearchAction urlTemplate should include {search_term_string}');
                }
              }
            }

            if (!a['query-input'] && !a.query) {
              issues.push('SearchAction missing query-input');
            }
          }
        }
      }
    }

    if (issues.length > 0) {
      return warn('schema-website-search', issues.join('; '), {
        websiteCount: websites.length,
        hasSearchAction,
        issues,
      });
    }

    if (!hasSearchAction) {
      return warn('schema-website-search', 'WebSite found but no SearchAction for sitelinks searchbox', {
        websiteCount: websites.length,
        hasSearchAction: false,
        suggestion: 'Add potentialAction with SearchAction for sitelinks searchbox eligibility',
      });
    }

    return pass('schema-website-search', 'WebSite schema with SearchAction properly configured', {
      websiteCount: websites.length,
      hasSearchAction: true,
    });
  },
});
