import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn } from '../define-rule.js';

interface InsecureLink {
  /** Link href */
  href: string;
  /** Link text (truncated) */
  text: string;
  /** Current rel attribute */
  rel: string;
  /** Missing noopener */
  missingNoopener: boolean;
  /** Missing noreferrer */
  missingNoreferrer: boolean;
}

/**
 * Rule: External Link Security
 *
 * Checks that external links with target="_blank" have rel="noopener"
 * and optionally "noreferrer" to prevent security and privacy issues.
 *
 * - noopener: Prevents new page from accessing window.opener (security)
 * - noreferrer: Also prevents passing referrer header (privacy)
 */
export const externalLinksSecurityRule = defineRule({
  id: 'security-external-links',
  name: 'External Link Security',
  description: 'Checks external target="_blank" links for noopener and noreferrer',
  category: 'security',
  weight: 3,
  run: (context: AuditContext) => {
    const { $, url } = context;
    const pageHost = new URL(url).hostname;

    const insecureLinks: InsecureLink[] = [];
    let totalBlankLinks = 0;

    $('a[target="_blank"]').each((_, el) => {
      const $link = $(el);
      const href = $link.attr('href') || '';

      // Skip non-navigating links
      if (!href || href.startsWith('#') || href.startsWith('javascript:') ||
          href.startsWith('mailto:') || href.startsWith('tel:')) {
        return;
      }

      totalBlankLinks++;

      // Check if external
      try {
        const linkHost = new URL(href, url).hostname;
        if (linkHost === pageHost) return; // Internal link
      } catch {
        return; // Invalid URL, skip
      }

      const rel = ($link.attr('rel') || '').toLowerCase();
      const relParts = rel.split(/\s+/).filter(Boolean);

      const hasNoopener = relParts.includes('noopener');
      const hasNoreferrer = relParts.includes('noreferrer');

      // noreferrer implies noopener in modern browsers, so either is acceptable
      if (!hasNoopener && !hasNoreferrer) {
        insecureLinks.push({
          href,
          text: $link.text().trim().slice(0, 50) || '[no text]',
          rel: rel || '[none]',
          missingNoopener: true,
          missingNoreferrer: true,
        });
      }
    });

    if (insecureLinks.length === 0) {
      return pass('security-external-links', 'All external target="_blank" links have noopener/noreferrer', {
        checkedLinks: totalBlankLinks,
      });
    }

    return warn(
      'security-external-links',
      `${insecureLinks.length} external link(s) with target="_blank" missing noopener/noreferrer`,
      {
        insecureLinks: insecureLinks.slice(0, 10),
        totalInsecure: insecureLinks.length,
        totalBlankLinks,
      }
    );
  },
});
