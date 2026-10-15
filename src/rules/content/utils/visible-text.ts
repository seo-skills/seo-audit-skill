import type { CheerioAPI } from 'cheerio';
import type { AnyNode } from 'domhandler';

/** Elements whose text is not page copy a visitor reads. */
const SKIP = 'script, style, noscript, textarea, svg, template, pre, code';

/**
 * Visible text nodes under body, skipping code, scripts, and stylesheets.
 *
 * @param $ - Parsed page
 * @returns One string per text node that survived the skip list
 */
export function collectVisibleText($: CheerioAPI): string[] {
  const chunks: string[] = [];

  const visit = (root: ReturnType<CheerioAPI>) => {
    root.contents().each((_, node) => {
      if (node.type !== 'text') return;
      const parent = node.parent;
      if (!parent || parent.type !== 'tag') return;
      if ($(parent).closest(SKIP).length > 0) return;
      const text = node.data ?? '';
      if (text.trim().length > 0) chunks.push(text);
    });
  };

  visit($('body'));
  $('body *').each((_, el) => {
    visit($(el));
  });

  return chunks;
}

/**
 * Tags whose content never renders as page text. A <template> renders only
 * when it is a declarative shadow root, and then without its <style>.
 */
const NOT_RENDERED = new Set(['script', 'style', 'noscript']);

/**
 * Body text as a visitor reads it, whitespace collapsed.
 *
 * `$('body').text()` also returns the source of every <script> and <style>
 * and the content of inert <template>s. developer.mozilla.org ships its web
 * components as declarative shadow DOM, and the CSS inside those shadow roots
 * was 81% of what rules counted as the page's text.
 *
 * The walk goes through `children` rather than selectors: Cheerio hangs
 * <template> content off a fragment that selectors do not descend into.
 *
 * @param $ - Parsed page
 * @returns The rendered text of <body>
 */
export function bodyText($: CheerioAPI): string {
  const parts: string[] = [];

  const walk = (node: AnyNode): void => {
    if (node.type === 'text') {
      parts.push(node.data);
      return;
    }
    if ('attribs' in node) {
      const tag = node.name.toLowerCase();
      if (NOT_RENDERED.has(tag)) return;
      if (tag === 'template' && node.attribs['shadowrootmode'] === undefined) return;
    }
    if ('children' in node) {
      for (const child of node.children) walk(child);
    }
  };

  for (const body of $('body').get()) walk(body);
  return parts.join('').replace(/\s+/g, ' ').trim();
}
