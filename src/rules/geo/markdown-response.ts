import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn } from '../define-rule.js';
import { looksLikeHtml, probeOnce } from './probe.js';

function originOf(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/**
 * Rule: Markdown response for the origin
 *
 * Probes the origin root once, asking for text/markdown, then a /index.md
 * path. Either representation is enough. The result is cached for the crawl.
 */
export const markdownResponseRule = defineRule({
  id: 'geo-markdown-response',
  name: 'Markdown Response',
  description: 'Checks that the origin can serve a Markdown representation of its root',
  category: 'geo',
  weight: 2,
  run: async (context: AuditContext) => {
    const origin = originOf(context.url);
    if (!origin) {
      return pass('geo-markdown-response', 'Page URL has no origin to probe', { found: false });
    }

    const negotiated = await probeOnce(context, `${origin}/`, { Accept: 'text/markdown' });
    if (
      negotiated &&
      negotiated.status === 200 &&
      (/markdown/i.test(negotiated.contentType) || !looksLikeHtml(negotiated))
    ) {
      return pass('geo-markdown-response', 'Root responds with Markdown', { via: 'accept' });
    }

    const variant = await probeOnce(context, `${origin}/index.md`, {});
    if (variant && variant.status === 200 && !looksLikeHtml(variant)) {
      return pass('geo-markdown-response', 'index.md is available', { via: 'index.md' });
    }

    return warn('geo-markdown-response', 'The origin does not serve a Markdown representation of /', {
      recommendation:
        'Answer Accept: text/markdown for /, or publish /index.md, so an agent can read the page without the HTML chrome.',
    });
  },
});
