import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn } from '../define-rule.js';

/**
 * Rule: Check for form controls with more than one label
 *
 * Assistive technologies disagree on what to do with several <label for> on one
 * control: some read the first, some the last, some all of them. The result is
 * that the field is announced differently depending on the user's software.
 */
export const formMultipleLabelsRule = defineRule({
  id: 'a11y-form-multiple-labels',
  name: 'Single Label Per Field',
  description: 'Checks that no form control is targeted by more than one <label>',
  category: 'a11y',
  weight: 3,
  run: (context: AuditContext) => {
    const { $, url } = context;

    const labelsFor = new Map<string, number>();
    $('label[for]').each((_, el) => {
      const target = $(el).attr('for')?.trim();
      if (!target) return;
      labelsFor.set(target, (labelsFor.get(target) ?? 0) + 1);
    });

    // Collect existing IDs rather than building a selector per ID: `CSS.escape`
    // is a browser API, and an unescaped `#id` selector breaks on IDs
    // containing dots, colons or brackets.
    const existingIds = new Set<string>();
    $('[id]').each((_, el) => {
      const id = $(el).attr('id')?.trim();
      if (id) existingIds.add(id);
    });

    const multiple: { id: string; labels: number }[] = [];
    for (const [id, count] of labelsFor) {
      // Only a control that exists can actually be mislabelled.
      if (count > 1 && existingIds.has(id)) {
        multiple.push({ id, labels: count });
      }
    }

    const details = { url, multiple };

    if (multiple.length > 0) {
      return warn(
        'a11y-form-multiple-labels',
        `${multiple.length} form control(s) have multiple labels: ${multiple
          .map((m) => `#${m.id} (${m.labels})`)
          .join(', ')}`,
        details
      );
    }

    return pass('a11y-form-multiple-labels', 'No form control has multiple labels', details);
  },
});
