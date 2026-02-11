import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn } from '../define-rule.js';

/**
 * Rule: Check if canonical URL protocol matches the page URL protocol
 *
 * A mismatch between the page protocol (HTTP vs HTTPS) and the canonical
 * URL protocol signals conflicting instructions to search engines. This
 * can cause indexing confusion and split link equity between protocol
 * variants.
 */
export const httpHttpsDuplicateRule = defineRule({
  id: 'url-http-https-duplicate',
  name: 'HTTP/HTTPS Canonical Mismatch',
  description:
    'Checks if the canonical URL uses a different protocol (HTTP vs HTTPS) than the page URL',
  category: 'url',
  weight: 4,
  run: async (context: AuditContext) => {
    const { url, $ } = context;

    try {
      const canonicalHref = $('link[rel="canonical"]').attr('href');

      // No canonical tag means no mismatch to detect
      if (!canonicalHref || canonicalHref.trim() === '') {
        return pass(
          'url-http-https-duplicate',
          'No canonical URL specified (no protocol mismatch to check)',
          { url, canonical: null }
        );
      }

      const canonical = canonicalHref.trim();

      // Only check absolute canonical URLs with a protocol
      if (!canonical.startsWith('http://') && !canonical.startsWith('https://')) {
        return pass(
          'url-http-https-duplicate',
          'Canonical URL is relative (no protocol mismatch possible)',
          { url, canonical }
        );
      }

      const pageUrl = new URL(url);
      const canonicalUrl = new URL(canonical);

      if (pageUrl.protocol !== canonicalUrl.protocol) {
        return warn(
          'url-http-https-duplicate',
          `Canonical protocol (${canonicalUrl.protocol}//) differs from page protocol (${pageUrl.protocol}//)`,
          {
            url,
            pageProtocol: pageUrl.protocol,
            canonical,
            canonicalProtocol: canonicalUrl.protocol,
            fix: `Update canonical to use ${pageUrl.protocol}//: ${canonical.replace(canonicalUrl.protocol, pageUrl.protocol)}`,
          }
        );
      }

      return pass(
        'url-http-https-duplicate',
        'Canonical URL protocol matches page URL protocol',
        {
          url,
          protocol: pageUrl.protocol,
          canonical,
        }
      );
    } catch {
      return pass('url-http-https-duplicate', 'Could not parse URL or canonical', {
        url,
      });
    }
  },
});
