import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn } from '../define-rule.js';

/**
 * Rule: Check robots meta tag for indexing directives
 *
 * Detects directives like noindex, nofollow, noarchive that may
 * limit search visibility or indexation.
 */
export const robotsMetaRule = defineRule({
  id: 'core-seo-robots-meta',
  name: 'Robots Meta',
  description: 'Checks robots meta tag for indexing directives',
  category: 'core-seo',
  weight: 5,
  run: async (context: AuditContext) => {
    const { $, headers } = context;

    const issues: string[] = [];
    const allDirectives: { source: string; directives: string[] }[] = [];

    // Restrictive directives that limit visibility
    const restrictiveDirectives = [
      'noindex',
      'nofollow',
      'noarchive',
      'nosnippet', // Also checked by nosnippet rule, but relevant here for completeness
      'noimageindex',
      'none', // Equivalent to noindex, nofollow
    ];

    // Parse directive content
    const parseDirectives = (content: string): string[] => {
      return content
        .toLowerCase()
        .split(/[,\s]+/)
        .map((d) => d.trim())
        .filter((d) => d.length > 0);
    };

    // Check meta robots tag
    const robotsMeta = $('meta[name="robots"]');
    robotsMeta.each((_, el) => {
      const content = $(el).attr('content') || '';
      const directives = parseDirectives(content);
      allDirectives.push({ source: 'meta[name="robots"]', directives });

      for (const directive of directives) {
        if (restrictiveDirectives.includes(directive)) {
          issues.push(`robots: "${directive}"`);
        }
      }
    });

    // Check googlebot meta tag
    const googlebotMeta = $('meta[name="googlebot"]');
    googlebotMeta.each((_, el) => {
      const content = $(el).attr('content') || '';
      const directives = parseDirectives(content);
      allDirectives.push({ source: 'meta[name="googlebot"]', directives });

      for (const directive of directives) {
        if (restrictiveDirectives.includes(directive)) {
          issues.push(`googlebot: "${directive}"`);
        }
      }
    });

    // Check bingbot meta tag
    const bingbotMeta = $('meta[name="bingbot"]');
    bingbotMeta.each((_, el) => {
      const content = $(el).attr('content') || '';
      const directives = parseDirectives(content);
      allDirectives.push({ source: 'meta[name="bingbot"]', directives });

      for (const directive of directives) {
        if (restrictiveDirectives.includes(directive)) {
          issues.push(`bingbot: "${directive}"`);
        }
      }
    });

    // Check X-Robots-Tag header
    const xRobotsTag = headers['x-robots-tag'] || headers['X-Robots-Tag'] || '';
    if (xRobotsTag) {
      const directives = parseDirectives(xRobotsTag);
      allDirectives.push({ source: 'X-Robots-Tag header', directives });

      for (const directive of directives) {
        if (restrictiveDirectives.includes(directive)) {
          issues.push(`X-Robots-Tag: "${directive}"`);
        }
      }
    }

    if (issues.length > 0) {
      return warn(
        'core-seo-robots-meta',
        `Restrictive indexing directives found: ${issues.join(', ')}`,
        {
          issues,
          allDirectives,
          impact: 'These directives may limit search visibility or prevent indexation',
          recommendation: 'Remove restrictive directives unless intentionally blocking search engines',
        }
      );
    }

    // Check if any robots directives exist at all
    if (allDirectives.length === 0) {
      return pass(
        'core-seo-robots-meta',
        'No robots meta tag found (default: index, follow)',
        { allDirectives: [], defaultBehavior: 'index, follow' }
      );
    }

    return pass(
      'core-seo-robots-meta',
      'Robots directives allow indexing',
      { allDirectives }
    );
  },
});
