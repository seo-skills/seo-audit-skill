import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn } from '../define-rule.js';

/**
 * Rule: Rendered Links Check
 *
 * Checks if important navigation links are only present after JavaScript
 * rendering. Search engines discover pages through links, so links that
 * only exist in the rendered DOM may be missed during initial crawling.
 */
export const renderedLinksRule = defineRule({
  id: 'js-rendered-links',
  name: 'Rendered Links Dependency',
  description: 'Checks if important links are only present after JavaScript rendering',
  category: 'js',
  weight: 7,
  run: async (context: AuditContext) => {
    const rendered$ = (context as any).rendered$;

    if (!rendered$) {
      return pass(
        'js-rendered-links',
        'Rendered DOM not available (CWV/rendering not enabled), skipping check'
      );
    }

    const rawLinks = context.$('a[href]').length;
    const renderedLinks = rendered$('a[href]').length;
    const linkDifference = renderedLinks - rawLinks;

    const details = {
      rawLinkCount: rawLinks,
      renderedLinkCount: renderedLinks,
      addedByJs: linkDifference > 0 ? linkDifference : 0,
    };

    if (renderedLinks > rawLinks * 2 && linkDifference > 10) {
      return warn(
        'js-rendered-links',
        `JavaScript adds ${linkDifference} links to the page; most links are not in raw HTML`,
        {
          ...details,
          impact: 'Search engines may miss JS-rendered links during initial crawling',
          recommendation: 'Include critical navigation and internal links in server-side HTML for reliable discovery',
        }
      );
    }

    return pass(
      'js-rendered-links',
      'Links are mostly present in raw HTML',
      details
    );
  },
});
