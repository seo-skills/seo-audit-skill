import type { AuditContext } from '../../types.js';
import { defineRule, pass, fail } from '../define-rule.js';

/**
 * Localhost / dev-server URL patterns to detect.
 * Includes common development server ports.
 */
const LOCALHOST_PATTERNS = [
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
];

const DEV_PORT_PATTERNS = [
  ':3000',
  ':8080',
  ':8000',
  ':4200',
  ':5173',
  ':5000',
];

/**
 * Tests whether a URL string contains a localhost or dev-server reference.
 */
function isLocalhostUrl(href: string): boolean {
  const lower = href.toLowerCase();

  for (const pattern of LOCALHOST_PATTERNS) {
    if (lower.includes(pattern)) return true;
  }

  for (const port of DEV_PORT_PATTERNS) {
    if (lower.includes(port)) {
      // Verify the port appears in a host context, not inside a path segment
      // like "/article:3000-words". We check that the character before the colon
      // is a valid hostname char (letter, digit, dot, bracket for IPv6).
      const idx = lower.indexOf(port);
      if (idx > 0) {
        const before = lower[idx - 1];
        if (/[a-z0-9.\]]/.test(before)) return true;
      } else if (idx === 0) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Rule: Check for links pointing to localhost or development server URLs
 *
 * Links to localhost, 127.0.0.1, 0.0.0.0, or common dev ports (3000, 8080,
 * 8000, 4200, 5173, 5000) indicate leftover development references that will
 * not resolve for real users or search engine crawlers.
 */
export const localhostRule = defineRule({
  id: 'links-localhost',
  name: 'No Localhost Links',
  description: 'Checks for links pointing to localhost, 127.0.0.1, or common development server ports',
  category: 'links',
  weight: 8,
  run: (context: AuditContext) => {
    const found: Array<{ element: string; href: string }> = [];

    // 1. Check context.links (already-extracted anchor hrefs)
    for (const link of context.links) {
      if (isLocalhostUrl(link.href)) {
        found.push({ element: 'a', href: link.href });
      }
    }

    // 2. Scan raw href/src attributes on a, link, script, img elements
    //    This catches references that may not be in context.links (e.g. <link>, <script>, <img>)
    const selector = 'a[href], link[href], script[src], img[src]';
    context.$(selector).each((_i, el) => {
      const node = context.$(el);
      const href = node.attr('href') || node.attr('src') || '';
      if (!href) return;

      if (isLocalhostUrl(href)) {
        const tag = (el as unknown as { tagName: string }).tagName || 'unknown';
        // Avoid duplicates from context.links already captured above
        const alreadyCaptured = found.some(
          (f) => f.href === href && f.element === tag
        );
        if (!alreadyCaptured) {
          found.push({ element: tag, href });
        }
      }
    });

    if (found.length > 0) {
      return fail(
        'links-localhost',
        `Found ${found.length} localhost/development URL reference(s)`,
        {
          localhostCount: found.length,
          localhostLinks: found.slice(0, 10),
          recommendation:
            'Replace localhost and development URLs with production URLs before deploying',
        }
      );
    }

    return pass(
      'links-localhost',
      'No localhost or development URL references found',
      { totalElementsChecked: context.links.length }
    );
  },
});
