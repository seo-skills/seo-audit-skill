import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn } from '../define-rule.js';

interface ProtocolRelativeItem {
  /** HTML tag name */
  tag: string;
  /** The protocol-relative URL */
  url: string;
  /** Attribute containing the URL (href or src) */
  attribute: string;
}

/**
 * Resource tags to check for protocol-relative URLs.
 * Excludes <a> tags because anchor links with // are a linking concern, not a resource loading concern.
 */
const RESOURCE_SELECTORS = [
  { selector: 'link[href^="//"]', attribute: 'href' },
  { selector: 'script[src^="//"]', attribute: 'src' },
  { selector: 'img[src^="//"]', attribute: 'src' },
  { selector: 'source[src^="//"]', attribute: 'src' },
  { selector: 'source[srcset]', attribute: 'srcset' },
  { selector: 'video[src^="//"]', attribute: 'src' },
  { selector: 'audio[src^="//"]', attribute: 'src' },
  { selector: 'iframe[src^="//"]', attribute: 'src' },
  { selector: 'embed[src^="//"]', attribute: 'src' },
  { selector: 'object[data^="//"]', attribute: 'data' },
] as const;

/**
 * Rule: Protocol-Relative URLs in Resources
 *
 * Detects resources loaded using protocol-relative URLs (starting with //).
 * These URLs inherit the protocol of the parent page: on an HTTP page they
 * load over HTTP, and on HTTPS they load over HTTPS. This can cause:
 * - Mixed content issues on HTTP pages
 * - Unexpected HTTP loading in development environments
 * - Deprecation by modern best practices (explicit https:// is preferred)
 */
export const protocolRelativeRule = defineRule({
  id: 'security-protocol-relative',
  name: 'Protocol-Relative URLs',
  description: 'Checks for protocol-relative URLs (starting with //) in resource references',
  category: 'security',
  weight: 6,
  run: (context: AuditContext) => {
    const { $ } = context;

    const found: ProtocolRelativeItem[] = [];

    for (const { selector, attribute } of RESOURCE_SELECTORS) {
      $(selector).each((_, el) => {
        const tag = el.tagName?.toLowerCase() || 'unknown';
        const value = $(el).attr(attribute) || '';

        if (attribute === 'srcset') {
          // Parse srcset for protocol-relative URLs
          const srcsetParts = value.split(',').map((s) => s.trim());
          for (const part of srcsetParts) {
            const srcUrl = part.split(/\s+/)[0];
            if (srcUrl && srcUrl.startsWith('//')) {
              found.push({ tag, url: srcUrl, attribute: 'srcset' });
            }
          }
        } else if (value.startsWith('//')) {
          found.push({ tag, url: value, attribute });
        }
      });
    }

    if (found.length === 0) {
      return pass(
        'security-protocol-relative',
        'No protocol-relative URLs found in resource references',
        { count: 0 }
      );
    }

    // Group by tag for summary
    const byTag = found.reduce(
      (acc, item) => {
        acc[item.tag] = (acc[item.tag] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    return warn(
      'security-protocol-relative',
      `Found ${found.length} protocol-relative URL(s) in resources; use explicit https:// instead`,
      {
        count: found.length,
        byTag,
        examples: found.slice(0, 10).map((item) => `<${item.tag} ${item.attribute}="${item.url}">`),
        recommendation: 'Replace protocol-relative URLs (//example.com) with explicit https:// URLs to prevent potential HTTP downgrades',
      }
    );
  },
});
