import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn } from '../define-rule.js';

/**
 * Extract Sitemap directives from robots.txt content
 */
function extractSitemapDirectives(content: string): string[] {
  const sitemapUrls: string[] = [];
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    // Skip comments
    if (trimmed.startsWith('#')) continue;

    // Case-insensitive match for Sitemap: directive
    if (/^sitemap:/i.test(trimmed)) {
      const url = trimmed.substring(trimmed.indexOf(':') + 1).trim();
      if (url) {
        sitemapUrls.push(url);
      }
    }
  }

  return sitemapUrls;
}

/**
 * Rule: Sitemap in robots.txt
 *
 * Checks that robots.txt references the sitemap via a Sitemap: directive.
 * Including the sitemap URL in robots.txt helps search engines discover
 * and crawl the sitemap without needing to guess its location.
 */
export const sitemapInRobotstxtRule = defineRule({
  id: 'crawl-sitemap-in-robotstxt',
  name: 'Sitemap in robots.txt',
  description: 'Checks if robots.txt references the sitemap',
  category: 'crawl',
  weight: 6,
  run: async (context: AuditContext) => {
    const robotsTxtContent = (context as any).robotsTxtContent as string | undefined;

    if (!robotsTxtContent) {
      return pass(
        'crawl-sitemap-in-robotstxt',
        'No robots.txt content available to check',
        { robotsTxtAvailable: false }
      );
    }

    const sitemapDirectives = extractSitemapDirectives(robotsTxtContent);

    const details = {
      sitemapDirectiveCount: sitemapDirectives.length,
      sitemapUrls: sitemapDirectives,
    };

    if (sitemapDirectives.length === 0) {
      return warn(
        'crawl-sitemap-in-robotstxt',
        'robots.txt does not reference a sitemap',
        {
          ...details,
          impact: 'Search engines may not discover the sitemap without a Sitemap: directive',
          recommendation: 'Add a Sitemap: directive to robots.txt (e.g., Sitemap: https://example.com/sitemap.xml)',
        }
      );
    }

    return pass(
      'crawl-sitemap-in-robotstxt',
      `robots.txt references ${sitemapDirectives.length} sitemap(s)`,
      details
    );
  },
});
