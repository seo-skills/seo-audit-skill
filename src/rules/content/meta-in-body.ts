import type { AuditContext } from '../../types.js';
import { defineRule, pass, fail } from '../define-rule.js';
import { DOCUMENT_TITLE } from '../document-title.js';

/**
 * Rule: Detect meta tags incorrectly placed in document body
 *
 * Meta tags in the body are ignored by browsers and search engines.
 * This is often caused by incorrect HTML structure or dynamic rendering issues.
 *
 * Critical issue - returns fail status.
 */
export const metaInBodyRule = defineRule({
  id: 'content-meta-in-body',
  name: 'Meta Tags in Body',
  description: 'Detects meta tags incorrectly placed in document body',
  category: 'content',
  weight: 8,
  run: async (context: AuditContext) => {
    const { $ } = context;
    const issues: { tag: string; content?: string }[] = [];

    // Check for <meta> tags inside <body>
    $('body meta').each((_, el) => {
      const $el = $(el);
      // Structured data, not document metadata: microdata allows <meta
      // itemprop> in flow content, and HTML+RDFa allows <meta property> inside
      // an item (a typeof/vocab scope), as in Google's BreadcrumbList example.
      if ($el.attr('itemprop') !== undefined) return;
      if ($el.attr('property') && $el.parents('[typeof], [vocab]').length > 0) return;

      const attribute = ['name', 'property', 'http-equiv', 'charset'].find(
        (attr) => $el.attr(attr) !== undefined
      );
      const content = $el.attr('content')?.substring(0, 50);
      issues.push({
        tag: attribute ? `<meta ${attribute}="${$el.attr(attribute)}">` : '<meta>',
        content: content ? `${content}${content.length >= 50 ? '...' : ''}` : undefined,
      });
    });

    // Check for <title> inside <body>
    const bodyTitle = $(`body ${DOCUMENT_TITLE}`);
    if (bodyTitle.length > 0) {
      issues.push({
        tag: '<title>',
        content: bodyTitle.first().text()?.substring(0, 50),
      });
    }

    // Check for <link rel="canonical"> inside <body>
    $('body link[rel="canonical"]').each((_, el) => {
      issues.push({
        tag: '<link rel="canonical">',
        content: $(el).attr('href')?.substring(0, 50),
      });
    });

    // Check for other important links in body
    $('body link[rel="icon"], body link[rel="shortcut icon"]').each((_, el) => {
      issues.push({
        tag: `<link rel="${$(el).attr('rel')}">`,
        content: $(el).attr('href')?.substring(0, 50),
      });
    });

    if (issues.length > 0) {
      return fail(
        'content-meta-in-body',
        `Found ${issues.length} meta element${issues.length > 1 ? 's' : ''} incorrectly placed in document body`,
        {
          issues,
          impact:
            'Meta tags in the body are ignored by browsers and search engines, causing SEO signals to be lost',
          recommendation:
            'Move all meta tags, title, and canonical link to the <head> section. Check for HTML template errors or dynamic rendering issues.',
        }
      );
    }

    return pass(
      'content-meta-in-body',
      'All meta elements are correctly placed in document head',
      {
        checkedElements: ['<meta>', '<title>', '<link rel="canonical">', '<link rel="icon">'],
      }
    );
  },
});
