import type { AuditContext } from '../../types.js';
import { defineRule, pass, fail } from '../define-rule.js';

/**
 * Rule: Multiple Viewport Meta Tags
 *
 * Detects pages with more than one <meta name="viewport"> tag. When multiple
 * viewport tags are present, browsers use the last one encountered, but the
 * earlier tags may confuse content management systems, validators, and
 * development tools. This typically occurs from:
 * - A CMS injecting a viewport tag in addition to one in the template
 * - Multiple plugins or frameworks each adding their own viewport tag
 * - Copy-paste errors in the HTML head
 */
export const multipleViewportsRule = defineRule({
  id: 'mobile-multiple-viewports',
  name: 'Multiple Viewport Tags',
  description: 'Checks for multiple viewport meta tags which can cause confusion',
  category: 'mobile',
  weight: 8,
  run: (context: AuditContext) => {
    const { $ } = context;

    const viewportTags = $('meta[name="viewport"]');
    const count = viewportTags.length;

    if (count <= 1) {
      return pass(
        'mobile-multiple-viewports',
        count === 0
          ? 'No viewport meta tags found (handled by viewport-present rule)'
          : 'Single viewport meta tag found (correct)',
        { viewportCount: count }
      );
    }

    // Collect the content of each viewport tag for details
    const viewportContents: string[] = [];
    viewportTags.each((_, el) => {
      const content = $(el).attr('content') || '(empty)';
      viewportContents.push(content);
    });

    return fail(
      'mobile-multiple-viewports',
      `Found ${count} viewport meta tags; browsers use the last one, which can cause unexpected behavior`,
      {
        viewportCount: count,
        viewportContents,
        recommendation: 'Remove duplicate viewport meta tags; keep only one with content="width=device-width, initial-scale=1"',
      }
    );
  },
});
