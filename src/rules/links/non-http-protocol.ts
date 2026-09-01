import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn } from '../define-rule.js';

// Reference hint: links/has-link-to-a-non-http-protocol

/**
 * Matches a URI scheme at the start of an href (e.g. "ftp:", "intent:").
 */
const SCHEME_PATTERN = /^([a-z][a-z0-9+.-]*):/i;

/**
 * Schemes that are expected on anchor hrefs and handled elsewhere:
 * - http/https: normal web links
 * - tel/mailto: extracted into context.specialLinks, validated by
 *   links-tel-mailto
 * - javascript: recorded in context.invalidLinks, covered by
 *   links-invalid-links
 */
const ALLOWED_SCHEMES = new Set(['http', 'https', 'tel', 'mailto', 'javascript']);

/**
 * Rule: Check for anchor links using a non-HTTP protocol
 *
 * Links whose destination uses a protocol other than HTTP(S) — ftp:, file:,
 * intent:, chrome:, and so on — are handed off to whatever external handler
 * the user's system has registered, so their behaviour is unpredictable and
 * any link equity flowing through them is lost. Legitimate tel: and mailto:
 * links are excluded; they are validated separately by links-tel-mailto.
 */
export const nonHttpProtocolRule = defineRule({
  id: 'links-non-http-protocol',
  name: 'No Non-HTTP Protocol Links',
  description:
    'Checks for anchor links using protocols other than HTTP(S), tel: or mailto: (e.g. ftp:, file:, intent:)',
  category: 'links',
  weight: 4,
  run: (context: AuditContext) => {
    const found: Array<{ href: string; protocol: string; text: string }> = [];

    // Scan raw anchor hrefs rather than context.links: the extractor diverts
    // tel:/mailto:/data: out of context.links, and data: anchors should still
    // be flagged here.
    context.$('a[href]').each((_i, el) => {
      const node = context.$(el);
      const href = node.attr('href') || '';
      const match = SCHEME_PATTERN.exec(href.trim());
      if (!match) return;

      const protocol = match[1].toLowerCase();
      if (ALLOWED_SCHEMES.has(protocol)) return;

      const text = (node.text().trim() || node.attr('title') || '').slice(0, 200);
      found.push({ href, protocol, text });
    });

    if (found.length > 0) {
      const protocols = [...new Set(found.map((f) => f.protocol))];

      return warn(
        'links-non-http-protocol',
        `Found ${found.length} link(s) using non-HTTP protocol(s): ${protocols.join(', ')}`,
        {
          nonHttpLinkCount: found.length,
          protocols,
          nonHttpLinks: found.slice(0, 10),
          recommendation:
            'Review links using non-HTTP protocols; browsers hand them to external handlers, so prefer HTTP(S) URLs unless the protocol is intentional',
        }
      );
    }

    return pass(
      'links-non-http-protocol',
      'All links use HTTP(S), tel: or mailto: protocols',
      { totalLinksChecked: context.$('a[href]').length }
    );
  },
});
