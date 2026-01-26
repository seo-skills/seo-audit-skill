import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, fail } from '../define-rule.js';

interface MissingAriaLabel {
  /** Element tag name */
  tag: string;
  /** Element type attribute if present */
  type?: string;
  /** Element id if present */
  id?: string;
  /** Element class if present */
  class?: string;
  /** Why it needs a label */
  reason: string;
}

/**
 * Interactive elements that require accessible names
 */
const INTERACTIVE_SELECTORS = [
  'button:not([aria-label]):not([aria-labelledby])',
  'a[href]:not([aria-label]):not([aria-labelledby])',
  'input:not([type="hidden"]):not([aria-label]):not([aria-labelledby])',
  'select:not([aria-label]):not([aria-labelledby])',
  'textarea:not([aria-label]):not([aria-labelledby])',
  '[role="button"]:not([aria-label]):not([aria-labelledby])',
  '[role="link"]:not([aria-label]):not([aria-labelledby])',
  '[role="checkbox"]:not([aria-label]):not([aria-labelledby])',
  '[role="radio"]:not([aria-label]):not([aria-labelledby])',
  '[role="tab"]:not([aria-label]):not([aria-labelledby])',
  '[role="menuitem"]:not([aria-label]):not([aria-labelledby])',
  '[role="option"]:not([aria-label]):not([aria-labelledby])',
];

/**
 * Check if element has accessible name via text content, title, or associated label
 */
function hasAccessibleName($: cheerio.CheerioAPI, el: cheerio.Element): boolean {
  const $el = $(el);

  // Check for visible text content
  const textContent = $el.text().trim();
  if (textContent.length > 0) {
    return true;
  }

  // Check for title attribute
  if ($el.attr('title')?.trim()) {
    return true;
  }

  // Check for value attribute on buttons
  if ($el.is('input[type="submit"], input[type="button"], input[type="reset"]')) {
    if ($el.attr('value')?.trim()) {
      return true;
    }
  }

  // Check for associated label (for form inputs)
  const id = $el.attr('id');
  if (id) {
    const label = $(`label[for="${id}"]`);
    if (label.length > 0 && label.text().trim()) {
      return true;
    }
  }

  // Check for wrapping label
  const parentLabel = $el.closest('label');
  if (parentLabel.length > 0 && parentLabel.text().trim()) {
    return true;
  }

  // Check for aria-label or aria-labelledby (already filtered in selector, but double-check)
  if ($el.attr('aria-label')?.trim() || $el.attr('aria-labelledby')?.trim()) {
    return true;
  }

  // Check for img with alt inside buttons/links
  const imgAlt = $el.find('img[alt]').first().attr('alt')?.trim();
  if (imgAlt) {
    return true;
  }

  // Check for SVG with title
  const svgTitle = $el.find('svg title').first().text().trim();
  if (svgTitle) {
    return true;
  }

  return false;
}

/**
 * Rule: ARIA Labels
 *
 * Checks that interactive elements have accessible names via:
 * - Text content
 * - aria-label or aria-labelledby
 * - Associated label element
 * - title attribute
 * - img alt text (for icon buttons)
 */
export const ariaLabelsRule = defineRule({
  id: 'a11y-aria-labels',
  name: 'ARIA Labels',
  description: 'Checks that interactive elements have accessible names',
  category: 'a11y',
  weight: 10,
  run: (context: AuditContext) => {
    const { $ } = context;

    const missingLabels: MissingAriaLabel[] = [];
    const checkedCount = { total: 0 };

    for (const selector of INTERACTIVE_SELECTORS) {
      $(selector).each((_, el) => {
        checkedCount.total++;

        if (!hasAccessibleName($, el)) {
          const $el = $(el);
          const tag = el.tagName?.toLowerCase() || 'unknown';

          missingLabels.push({
            tag,
            type: $el.attr('type'),
            id: $el.attr('id'),
            class: $el.attr('class')?.split(' ')[0], // First class only
            reason: getReasonForElement(tag, $el.attr('role')),
          });
        }
      });
    }

    if (missingLabels.length === 0) {
      return pass('a11y-aria-labels', 'All interactive elements have accessible names', {
        checkedElements: checkedCount.total,
      });
    }

    const severity = missingLabels.length > 5 ? 'fail' : 'warn';
    const message = `Found ${missingLabels.length} interactive element(s) without accessible names`;

    if (severity === 'fail') {
      return fail('a11y-aria-labels', message, {
        missingLabels: missingLabels.slice(0, 10),
        totalMissing: missingLabels.length,
        checkedElements: checkedCount.total,
      });
    }

    return warn('a11y-aria-labels', message, {
      missingLabels: missingLabels.slice(0, 10),
      totalMissing: missingLabels.length,
      checkedElements: checkedCount.total,
    });
  },
});

function getReasonForElement(tag: string, role?: string): string {
  if (role) {
    return `Elements with role="${role}" need accessible names for screen readers`;
  }

  switch (tag) {
    case 'button':
      return 'Buttons need accessible names for screen readers';
    case 'a':
      return 'Links need accessible names to describe their destination';
    case 'input':
      return 'Form inputs need labels for screen readers';
    case 'select':
      return 'Select elements need labels to describe their purpose';
    case 'textarea':
      return 'Textareas need labels to describe their purpose';
    default:
      return 'Interactive elements need accessible names';
  }
}
