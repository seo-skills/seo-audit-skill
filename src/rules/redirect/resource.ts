import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn } from '../define-rule.js';

/**
 * Represents an HTTP resource found on an HTTPS page.
 */
interface HttpResource {
  /** Resource type (stylesheet, script, or image) */
  type: 'stylesheet' | 'script' | 'image';
  /** The HTTP URL of the resource */
  url: string;
}

/**
 * Rule: Resource Redirect Detection
 *
 * Checks if an HTTPS page references CSS, JavaScript, or image
 * resources via HTTP URLs. When a page is served over HTTPS,
 * HTTP resource URLs typically trigger a redirect to HTTPS,
 * adding unnecessary latency and wasting crawl budget.
 */
export const resourceRedirectRule = defineRule({
  id: 'redirect-resource',
  name: 'No HTTP Resource Redirects',
  description: 'Checks that HTTPS pages do not reference HTTP resources that cause redirect chains',
  category: 'redirect',
  weight: 10,
  run: (context: AuditContext) => {
    const { $, url } = context;

    // Only relevant for HTTPS pages
    if (!url.startsWith('https://')) {
      return pass('redirect-resource', 'Page is not HTTPS; resource redirect check not applicable');
    }

    const httpResources: HttpResource[] = [];

    // Check stylesheets loaded via HTTP
    $('link[rel="stylesheet"][href^="http://"]').each((_, el) => {
      const href = $(el).attr('href');
      if (href) {
        httpResources.push({ type: 'stylesheet', url: href });
      }
    });

    // Check scripts loaded via HTTP
    $('script[src^="http://"]').each((_, el) => {
      const src = $(el).attr('src');
      if (src) {
        httpResources.push({ type: 'script', url: src });
      }
    });

    // Check images loaded via HTTP
    $('img[src^="http://"]').each((_, el) => {
      const src = $(el).attr('src');
      if (src) {
        httpResources.push({ type: 'image', url: src });
      }
    });

    if (httpResources.length === 0) {
      return pass('redirect-resource', 'No HTTP resources found on HTTPS page');
    }

    // Group by type for summary
    const byType = httpResources.reduce(
      (acc, item) => {
        acc[item.type] = (acc[item.type] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    return warn(
      'redirect-resource',
      `Found ${httpResources.length} HTTP resource(s) on HTTPS page that likely cause redirect chains`,
      {
        totalHttpResources: httpResources.length,
        byType,
        resources: httpResources.slice(0, 20),
        recommendation: 'Update resource URLs to use HTTPS to avoid unnecessary redirects',
      }
    );
  },
});
