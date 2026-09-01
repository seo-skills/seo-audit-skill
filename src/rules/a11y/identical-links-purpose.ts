import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn } from '../define-rule.js';

/** Link text carries no meaning once case and punctuation are stripped */
function normalise(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/**
 * Rule: Check that identical link text leads to the same place
 *
 * Screen reader users can list every link on a page out of context. Two links
 * reading "read more" that go to different articles are indistinguishable in
 * that list, so there is no way to choose between them.
 */
export const identicalLinksPurposeRule = defineRule({
  id: 'a11y-identical-links-purpose',
  name: 'Identical Links Same Purpose',
  description: 'Checks that links sharing the same text point to the same destination',
  category: 'a11y',
  weight: 4,
  run: (context: AuditContext) => {
    const { $, url } = context;

    const byText = new Map<string, Set<string>>();

    $('a[href]').each((_, el) => {
      const $el = $(el);
      // The accessible name wins over the visible text when both exist.
      const name = $el.attr('aria-label')?.trim() || $el.text().trim() || $el.attr('title')?.trim();
      if (!name) return;

      const href = $el.attr('href')?.trim();
      if (!href || href.startsWith('#')) return;

      // `/docs` and `/docs/` are the same page, and a differing fragment is
      // usually a position within one rather than a separate destination.
      const destination = href.replace(/#.*$/, '').replace(/\/+$/, '') || '/';

      const key = normalise(name);
      if (!key) return;
      if (!byText.has(key)) byText.set(key, new Set());
      byText.get(key)!.add(destination);
    });

    const ambiguous = Array.from(byText)
      .filter(([, hrefs]) => hrefs.size > 1)
      .map(([text, hrefs]) => ({
        text,
        destinations: Array.from(hrefs).slice(0, 5),
        count: hrefs.size,
      }));

    const details = { url, ambiguous };

    if (ambiguous.length > 0) {
      return warn(
        'a11y-identical-links-purpose',
        `${ambiguous.length} link text(s) point to different destinations: ${ambiguous
          .map((a) => `"${a.text}" (${a.count} targets)`)
          .join(', ')}`,
        details
      );
    }

    return pass('a11y-identical-links-purpose', 'Links with identical text share a destination', details);
  },
});
