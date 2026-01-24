import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, fail } from '../define-rule.js';

interface UnlabeledInput {
  /** Input type */
  type: string;
  /** Input name attribute */
  name?: string;
  /** Input id attribute */
  id?: string;
  /** Placeholder text if present */
  placeholder?: string;
}

/**
 * Rule: Form Labels
 *
 * Checks that form inputs have associated labels via:
 * - <label for="id"> element
 * - Wrapping <label> element
 * - aria-label attribute
 * - aria-labelledby attribute
 *
 * Placeholder text alone is NOT sufficient as a label.
 */
export const formLabelsRule = defineRule({
  id: 'a11y-form-labels',
  name: 'Form Labels',
  description: 'Checks that form inputs have associated labels',
  category: 'accessibility',
  weight: 10,
  run: (context: AuditContext) => {
    const { $ } = context;

    const unlabeledInputs: UnlabeledInput[] = [];
    const labeledCount = { total: 0 };

    // Input types that require labels
    const inputSelector =
      'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="image"])';

    $(inputSelector).each((_, el) => {
      const $el = $(el);
      labeledCount.total++;

      if (!hasLabel($, $el)) {
        unlabeledInputs.push({
          type: $el.attr('type') || 'text',
          name: $el.attr('name'),
          id: $el.attr('id'),
          placeholder: $el.attr('placeholder'),
        });
      }
    });

    // Check select elements
    $('select').each((_, el) => {
      const $el = $(el);
      labeledCount.total++;

      if (!hasLabel($, $el)) {
        unlabeledInputs.push({
          type: 'select',
          name: $el.attr('name'),
          id: $el.attr('id'),
        });
      }
    });

    // Check textarea elements
    $('textarea').each((_, el) => {
      const $el = $(el);
      labeledCount.total++;

      if (!hasLabel($, $el)) {
        unlabeledInputs.push({
          type: 'textarea',
          name: $el.attr('name'),
          id: $el.attr('id'),
          placeholder: $el.attr('placeholder'),
        });
      }
    });

    if (labeledCount.total === 0) {
      return pass('a11y-form-labels', 'No form inputs found on page', {
        totalInputs: 0,
      });
    }

    if (unlabeledInputs.length === 0) {
      return pass('a11y-form-labels', 'All form inputs have associated labels', {
        totalInputs: labeledCount.total,
      });
    }

    const percentUnlabeled = Math.round((unlabeledInputs.length / labeledCount.total) * 100);
    const message = `${unlabeledInputs.length} of ${labeledCount.total} form inputs lack proper labels`;

    // Fail if more than 30% unlabeled or more than 3 unlabeled
    if (percentUnlabeled > 30 || unlabeledInputs.length > 3) {
      return fail('a11y-form-labels', message, {
        unlabeledInputs: unlabeledInputs.slice(0, 10),
        totalUnlabeled: unlabeledInputs.length,
        totalInputs: labeledCount.total,
        note: 'Placeholder text is not a substitute for labels',
      });
    }

    return warn('a11y-form-labels', message, {
      unlabeledInputs,
      totalInputs: labeledCount.total,
      note: 'Placeholder text is not a substitute for labels',
    });
  },
});

function hasLabel($: cheerio.CheerioAPI, $el: cheerio.Cheerio<cheerio.Element>): boolean {
  // Check for aria-label
  if ($el.attr('aria-label')?.trim()) {
    return true;
  }

  // Check for aria-labelledby
  const labelledBy = $el.attr('aria-labelledby');
  if (labelledBy) {
    const labelElement = $(`#${labelledBy.split(' ')[0]}`);
    if (labelElement.length > 0) {
      return true;
    }
  }

  // Check for associated label via id
  const id = $el.attr('id');
  if (id) {
    const label = $(`label[for="${id}"]`);
    if (label.length > 0 && label.text().trim()) {
      return true;
    }
  }

  // Check for wrapping label
  const parentLabel = $el.closest('label');
  if (parentLabel.length > 0) {
    // Wrapping label should have text content
    const labelText = parentLabel.clone().children().remove().end().text().trim();
    if (labelText) {
      return true;
    }
  }

  // Check for title attribute (acceptable but not preferred)
  if ($el.attr('title')?.trim()) {
    return true;
  }

  return false;
}
