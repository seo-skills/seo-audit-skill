import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn } from '../define-rule.js';

/**
 * Escape a string for safe use inside a CSS selector.
 * Handles characters that have special meaning in CSS selectors.
 */
function cssEscape(value: string): string {
  return value.replace(/([!"#$%&'()*+,./:;<=>?@[\\\]^`{|}~])/g, '\\$1');
}

/**
 * Rule: Check for broken fragment (anchor) links
 *
 * Internal links with a fragment identifier (e.g. #section) should reference
 * an element that actually exists on the page. Broken fragments create a poor
 * user experience because the browser cannot scroll to the expected section.
 * Search engines may also treat these as low-quality signals.
 */
export const brokenFragmentRule = defineRule({
  id: 'links-broken-fragment',
  name: 'No Broken Fragment Links',
  description: 'Checks that internal fragment links (#id) reference existing elements on the page',
  category: 'links',
  weight: 6,
  run: (context: AuditContext) => {
    const { links, url, $ } = context;

    let pageUrl: URL;
    try {
      pageUrl = new URL(url);
    } catch {
      return pass(
        'links-broken-fragment',
        'Could not parse page URL, skipping fragment check',
      );
    }

    // Collect same-page links that contain a fragment
    const fragmentLinks: Array<{ href: string; fragment: string }> = [];

    for (const link of links) {
      if (!link.isInternal) continue;

      const hashIdx = link.href.indexOf('#');
      if (hashIdx === -1) continue;

      const fragment = link.href.slice(hashIdx + 1);
      // Skip bare "#" (handled by other rules) and empty fragments
      if (!fragment) continue;

      // Only validate fragments for same-page links
      try {
        const linkUrl = new URL(link.href);
        const isSamePage =
          linkUrl.hostname === pageUrl.hostname &&
          linkUrl.pathname === pageUrl.pathname &&
          linkUrl.search === pageUrl.search;

        if (isSamePage) {
          fragmentLinks.push({ href: link.href, fragment });
        }
      } catch {
        // If the href is just "#something", treat it as same-page
        if (link.href.startsWith('#')) {
          fragmentLinks.push({ href: link.href, fragment });
        }
      }
    }

    if (fragmentLinks.length === 0) {
      return pass(
        'links-broken-fragment',
        'No same-page fragment links found to check',
        { fragmentLinksChecked: 0 }
      );
    }

    // De-duplicate fragments to avoid checking the same ID multiple times
    const uniqueFragments = [...new Set(fragmentLinks.map((f) => f.fragment))];
    const brokenFragments: string[] = [];

    for (const fragment of uniqueFragments) {
      const escaped = cssEscape(fragment);
      const byId = $(`#${escaped}`).length > 0;
      const byName = $(`[name="${escaped}"]`).length > 0;

      if (!byId && !byName) {
        brokenFragments.push(fragment);
      }
    }

    if (brokenFragments.length > 0) {
      // Map broken fragments back to the full hrefs for actionable details
      const brokenLinks = fragmentLinks
        .filter((f) => brokenFragments.includes(f.fragment))
        .slice(0, 5);

      return warn(
        'links-broken-fragment',
        `Found ${brokenFragments.length} fragment link(s) pointing to non-existent IDs`,
        {
          brokenCount: brokenFragments.length,
          totalFragmentLinks: fragmentLinks.length,
          brokenFragments: brokenFragments.slice(0, 5),
          brokenLinks: brokenLinks.map((l) => ({
            href: l.href,
            fragment: l.fragment,
          })),
          recommendation:
            'Add matching id attributes to target elements or update the fragment references',
        }
      );
    }

    return pass(
      'links-broken-fragment',
      `All ${fragmentLinks.length} same-page fragment link(s) have matching IDs`,
      { fragmentLinksChecked: fragmentLinks.length }
    );
  },
});
