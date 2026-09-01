import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn } from '../define-rule.js';

/**
 * Rule: Check for positive tabindex values
 *
 * A tabindex above 0 pulls the element to the front of the tab order, ahead of
 * everything in the document. Keeping that order coherent means maintaining it
 * by hand forever, so it almost always ends up not matching the visual layout.
 */
export const tabindexPositiveRule = defineRule({
  id: 'a11y-tabindex-positive',
  name: 'No Positive Tabindex',
  description: 'Checks that no element uses a tabindex greater than 0',
  category: 'a11y',
  weight: 3,
  run: (context: AuditContext) => {
    const { $, url } = context;

    const offenders: { tag: string; tabindex: number; id?: string }[] = [];

    $('[tabindex]').each((_, el) => {
      const $el = $(el);
      const raw = $el.attr('tabindex');
      const value = Number(raw);
      if (!Number.isFinite(value) || value <= 0) return;

      offenders.push({
        tag: ((el as { tagName?: string }).tagName ?? '?').toLowerCase(),
        tabindex: value,
        ...($el.attr('id') && { id: $el.attr('id') }),
      });
    });

    const details = { url, offenders };

    if (offenders.length > 0) {
      return warn(
        'a11y-tabindex-positive',
        `${offenders.length} element(s) use a positive tabindex, overriding the natural tab order`,
        details
      );
    }

    return pass('a11y-tabindex-positive', 'No positive tabindex values', details);
  },
});
