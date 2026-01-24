import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn } from '../define-rule.js';

/**
 * Rule: Check for HTTPS to HTTP downgrade links
 *
 * Pages served over HTTPS should not link to HTTP resources,
 * as this can cause mixed content warnings and security issues.
 */
export const httpsDowngradeRule = defineRule({
  id: 'links-https-downgrade',
  name: 'No HTTPS Downgrade Links',
  description: 'Checks that HTTPS pages do not link to HTTP URLs',
  category: 'links',
  weight: 1,
  run: (context: AuditContext) => {
    const { url, links } = context;

    // Only check HTTPS pages
    if (!url.startsWith('https://')) {
      return pass(
        'links-https-downgrade',
        'Page is not served over HTTPS, check not applicable',
        { pageProtocol: 'http' }
      );
    }

    // Find links that downgrade to HTTP
    const httpLinks = links.filter((link) => {
      try {
        const linkUrl = new URL(link.href);
        return linkUrl.protocol === 'http:';
      } catch {
        return false;
      }
    });

    if (httpLinks.length > 0) {
      // Get unique domains being linked to via HTTP
      const httpDomains = [...new Set(
        httpLinks.map((link) => {
          try {
            return new URL(link.href).hostname;
          } catch {
            return 'unknown';
          }
        })
      )];

      return warn(
        'links-https-downgrade',
        `Found ${httpLinks.length} link(s) from HTTPS page to HTTP URLs`,
        {
          httpLinkCount: httpLinks.length,
          httpDomains: httpDomains.slice(0, 10),
          httpLinks: httpLinks.slice(0, 10).map((l) => ({
            href: l.href,
            text: l.text,
          })),
        }
      );
    }

    return pass(
      'links-https-downgrade',
      'All links maintain HTTPS security',
      { totalLinksChecked: links.length }
    );
  },
});
