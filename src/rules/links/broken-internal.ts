import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, fail } from '../define-rule.js';
import { fetchUrl } from '../../crawler/fetcher.js';
import { rethrowIfAborted } from '../../errors.js';
import { internalLinkTargets } from './link-targets.js';

/**
 * Rule: Check that internal links return 200 (fail if 404/410/5xx)
 */
export const brokenInternalRule = defineRule({
  id: 'links-broken-internal',
  name: 'No Broken Internal Links',
  description: 'Checks that all internal links return HTTP 200 status codes',
  category: 'links',
  weight: 1,
  run: async (context: AuditContext) => {
    const { links } = context;
    const internalLinks = links.filter((link) => link.isInternal);

    if (internalLinks.length === 0) {
      return pass(
        'links-broken-internal',
        'No internal links found to check',
        { totalLinks: 0 }
      );
    }

    const targets = internalLinkTargets(links, context.url);

    const brokenLinks: Array<{ href: string; statusCode: number }> = [];
    // Status 0 means the check got no answer (timeout or network error). That
    // says nothing about the page, and on developer.mozilla.org every such URL
    // answered 200 when asked again, so it is reported apart from broken.
    const uncheckedLinks: string[] = [];

    for (const href of targets) {
      let statusCode: number;
      try {
        statusCode = await fetchUrl(href, 10000, context.signal);
      } catch (error) {
        rethrowIfAborted(error, context.signal);
        statusCode = 0;
      }

      if (statusCode === 0) {
        uncheckedLinks.push(href);
      } else if (statusCode === 404 || statusCode === 410 || statusCode >= 500) {
        brokenLinks.push({ href, statusCode });
      }
    }

    const details = {
      totalChecked: targets.length,
      totalLinks: internalLinks.length,
      ...(uncheckedLinks.length > 0 && {
        uncheckedCount: uncheckedLinks.length,
        uncheckedLinks: uncheckedLinks.slice(0, 10),
      }),
    };

    if (brokenLinks.length > 0) {
      return fail(
        'links-broken-internal',
        `Found ${brokenLinks.length} broken internal link(s) out of ${targets.length}`,
        {
          ...details,
          brokenCount: brokenLinks.length,
          brokenLinks: brokenLinks.slice(0, 10), // Limit to first 10
        }
      );
    }

    if (uncheckedLinks.length > 0) {
      return warn(
        'links-broken-internal',
        `No broken internal links found, but ${uncheckedLinks.length} of ${targets.length} could not be checked (timeout or network error)`,
        details
      );
    }

    return pass(
      'links-broken-internal',
      `All ${targets.length} internal link(s) are accessible`,
      details
    );
  },
});
