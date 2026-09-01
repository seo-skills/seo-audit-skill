import type { AuditContext } from '../../types.js';
import { defineRule, pass, fail } from '../define-rule.js';

/**
 * Rule: Check that headings contain content
 *
 * Screen reader users navigate by heading. An empty one appears in that list as
 * a dead entry, and it breaks the document outline for everyone parsing it —
 * search engines included.
 */
export const emptyHeadingRule = defineRule({
  id: 'a11y-empty-heading',
  name: 'Headings Contain Content',
  description: 'Checks that no heading element is empty or inaccessible',
  category: 'a11y',
  weight: 5,
  run: (context: AuditContext) => {
    const { $, url } = context;

    const empty: { tag: string; reason: string }[] = [];
    let total = 0;

    $('h1, h2, h3, h4, h5, h6').each((_, el) => {
      const $el = $(el);
      total++;
      if ($el.attr('aria-hidden') === 'true') return;

      const tag = (el as { tagName?: string }).tagName ?? 'h?';
      const text = $el.text().trim();
      // An image with alt text inside a heading names it perfectly well.
      const imgAlt = $el.find('img[alt]').toArray().some((img) => $(img).attr('alt')?.trim());

      if (text || imgAlt) return;
      if ($el.attr('aria-label')?.trim() || $el.attr('aria-labelledby')?.trim()) return;

      empty.push({ tag, reason: 'no text, labelled image, or ARIA label' });
    });

    const details = { url, total, empty };

    if (empty.length > 0) {
      return fail('a11y-empty-heading', `${empty.length} empty heading(s) found`, details);
    }

    return pass(
      'a11y-empty-heading',
      total > 0 ? `All ${total} heading(s) contain content` : 'No headings on the page',
      details
    );
  },
});
