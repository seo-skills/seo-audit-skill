import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn } from '../define-rule.js';

/**
 * Rule: Detect nosnippet directive that blocks search engine snippets
 *
 * The nosnippet directive prevents search engines from showing descriptions
 * in search results, which severely harms click-through rates.
 */
export const nosnippetRule = defineRule({
  id: 'core-seo-nosnippet',
  name: 'Nosnippet Directive',
  description: 'Detects pages preventing search engine snippets',
  category: 'core-seo',
  weight: 7,
  run: async (context: AuditContext) => {
    const { $, headers } = context;

    const issues: string[] = [];
    const directives: string[] = [];

    // Check meta robots tags
    const robotsMeta = $('meta[name="robots"]');
    robotsMeta.each((_, el) => {
      const content = $(el).attr('content')?.toLowerCase() || '';
      directives.push(content);

      if (content.includes('nosnippet')) {
        issues.push('Meta robots contains "nosnippet"');
      }

      // Check for max-snippet:0 which effectively blocks snippets
      const maxSnippetMatch = content.match(/max-snippet\s*:\s*(-?\d+)/);
      if (maxSnippetMatch && parseInt(maxSnippetMatch[1], 10) <= 0) {
        issues.push(`Meta robots contains "max-snippet:${maxSnippetMatch[1]}" (blocks snippets)`);
      }
    });

    // Check googlebot-specific meta tag
    const googlebotMeta = $('meta[name="googlebot"]');
    googlebotMeta.each((_, el) => {
      const content = $(el).attr('content')?.toLowerCase() || '';
      directives.push(`googlebot: ${content}`);

      if (content.includes('nosnippet')) {
        issues.push('Meta googlebot contains "nosnippet"');
      }

      const maxSnippetMatch = content.match(/max-snippet\s*:\s*(-?\d+)/);
      if (maxSnippetMatch && parseInt(maxSnippetMatch[1], 10) <= 0) {
        issues.push(`Meta googlebot contains "max-snippet:${maxSnippetMatch[1]}" (blocks snippets)`);
      }
    });

    // Check X-Robots-Tag header
    const xRobotsTag = headers['x-robots-tag'] || headers['X-Robots-Tag'] || '';
    if (xRobotsTag) {
      const lowerTag = xRobotsTag.toLowerCase();
      directives.push(`X-Robots-Tag: ${xRobotsTag}`);

      if (lowerTag.includes('nosnippet')) {
        issues.push('X-Robots-Tag header contains "nosnippet"');
      }

      const maxSnippetMatch = lowerTag.match(/max-snippet\s*:\s*(-?\d+)/);
      if (maxSnippetMatch && parseInt(maxSnippetMatch[1], 10) <= 0) {
        issues.push(`X-Robots-Tag header contains "max-snippet:${maxSnippetMatch[1]}" (blocks snippets)`);
      }
    }

    if (issues.length > 0) {
      return warn(
        'core-seo-nosnippet',
        `Page blocks search snippets: ${issues.join('; ')}`,
        {
          issues,
          directives,
          impact: 'Prevents search engines from showing descriptions in search results, severely harming click-through rates',
          recommendation: 'Remove nosnippet directive unless specifically needed for sensitive content (login, legal pages)',
        }
      );
    }

    return pass(
      'core-seo-nosnippet',
      'Page allows search engine snippets',
      { directives: directives.length > 0 ? directives : ['none found'] }
    );
  },
});
