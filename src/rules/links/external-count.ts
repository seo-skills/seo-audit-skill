import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn } from '../define-rule.js';

/**
 * Rule: Check external link count
 *
 * Too many external links can be a signal of a link farm or low-quality
 * content. This rule warns if a page has more than 100 external links.
 */
export const externalCountRule = defineRule({
  id: 'links-external-count',
  name: 'External Links Count',
  description: 'Checks that pages do not have an excessive number of external links',
  category: 'links',
  weight: 1,
  run: (context: AuditContext) => {
    const { links } = context;

    const externalLinks = links.filter((link) => !link.isInternal);
    const externalCount = externalLinks.length;

    // Get unique external domains
    const externalDomains = [...new Set(
      externalLinks.map((link) => {
        try {
          return new URL(link.href).hostname;
        } catch {
          return 'unknown';
        }
      })
    )];

    // Threshold for excessive external links
    const threshold = 100;

    if (externalCount > threshold) {
      return warn(
        'links-external-count',
        `Page has ${externalCount} external links (exceeds ${threshold} threshold)`,
        {
          externalLinkCount: externalCount,
          uniqueDomains: externalDomains.length,
          topDomains: externalDomains.slice(0, 10),
          threshold,
          recommendation: 'Reduce external links to essential, high-quality resources only',
        }
      );
    }

    return pass(
      'links-external-count',
      `Page has ${externalCount} external link(s) across ${externalDomains.length} domain(s)`,
      {
        externalLinkCount: externalCount,
        uniqueDomains: externalDomains.length,
        topDomains: externalDomains.slice(0, 10),
      }
    );
  },
});
