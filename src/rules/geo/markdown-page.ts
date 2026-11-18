import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn } from '../define-rule.js';
import { looksLikeHtml, probeOnce } from './probe.js';

function isMarkdown(result: { status: number; contentType: string; body: string } | null): boolean {
  if (!result || result.status !== 200) return false;
  if (/markdown/i.test(result.contentType)) return true;
  return !looksLikeHtml(result);
}

function siblingMarkdown(pageUrl: string): string | null {
  try {
    const url = new URL(pageUrl);
    if (url.pathname === '/' || url.pathname === '') return null;
    const path = url.pathname.replace(/\/$/, '');
    return `${url.origin}${path}.md`;
  } catch {
    return null;
  }
}

/**
 * Rule: Markdown for this URL
 *
 * The origin root is covered by geo-markdown-response. Every other URL is
 * probed once for Accept: text/markdown and for a sibling .md path.
 */
export const markdownPageRule = defineRule({
  id: 'geo-markdown-page',
  name: 'Markdown For This URL',
  description: 'Checks that a non-root URL has a Markdown representation',
  category: 'geo',
  weight: 1,
  run: async (context: AuditContext) => {
    let path = '/';
    try {
      path = new URL(context.url).pathname;
    } catch {
      return pass('geo-markdown-page', 'Page URL cannot be parsed', { found: false });
    }
    if (path === '/' || path === '') {
      return pass('geo-markdown-page', 'The origin root is checked by the Markdown response rule', {
        root: true,
      });
    }

    const negotiated = await probeOnce(context, context.url, { Accept: 'text/markdown' });
    if (isMarkdown(negotiated)) {
      return pass('geo-markdown-page', 'This URL responds with Markdown', { via: 'accept' });
    }

    const sibling = siblingMarkdown(context.url);
    if (sibling) {
      const variant = await probeOnce(context, sibling, {});
      if (isMarkdown(variant)) {
        return pass('geo-markdown-page', `${sibling} is available`, { via: 'sibling' });
      }
    }

    return warn('geo-markdown-page', 'This URL has no Markdown representation', {
      recommendation:
        'Answer Accept: text/markdown for this URL, or publish the same path with a .md suffix.',
    });
  },
});
