import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, fail } from '../define-rule.js';

/**
 * Rule: Meta Refresh Redirect
 *
 * Checks for <meta http-equiv="refresh"> tags in the HTML.
 * Meta refresh redirects are problematic for SEO because:
 * - Search engines may not follow them reliably
 * - They cause poor user experience (flash of original page)
 * - Server-side 301 redirects are the correct approach
 */
export const metaRefreshRule = defineRule({
  id: 'redirect-meta-refresh',
  name: 'No Meta Refresh Redirect',
  description: 'Checks for meta refresh redirects that should use server-side 301 redirects',
  category: 'redirect',
  weight: 15,
  run: (context: AuditContext) => {
    const { $ } = context;

    const metaRefresh = $('meta[http-equiv="refresh"]');

    if (metaRefresh.length === 0) {
      return pass('redirect-meta-refresh', 'No meta refresh redirect found');
    }

    const content = metaRefresh.first().attr('content') || '';

    // Parse the content attribute: "delay" or "delay;url=destination"
    const delayMatch = content.match(/^\s*(\d+)\s*(;|$)/);
    const delay = delayMatch ? parseInt(delayMatch[1], 10) : 0;
    const urlMatch = content.match(/;\s*url\s*=\s*['"]?([^'">\s]+)/i);
    const targetUrl = urlMatch ? urlMatch[1] : undefined;

    const details: Record<string, unknown> = {
      content,
      delay,
      ...(targetUrl && { targetUrl }),
    };

    if (delay === 0) {
      return fail(
        'redirect-meta-refresh',
        'Meta refresh with delay 0 detected; use a server-side 301 redirect instead',
        details
      );
    }

    return warn(
      'redirect-meta-refresh',
      `Meta refresh with ${delay}s delay detected; search engines may not follow this redirect`,
      details
    );
  },
});
