import type { AuditContext } from '../../types.js';
import { defineRule, pass, fail } from '../define-rule.js';

/**
 * ARIA roles defined by WAI-ARIA 1.2. An unrecognised role is ignored entirely
 * by assistive technology, so the element falls back to its native semantics.
 */
const VALID_ROLES = new Set([
  'alert', 'alertdialog', 'application', 'article', 'banner', 'blockquote', 'button',
  'caption', 'cell', 'checkbox', 'code', 'columnheader', 'combobox', 'complementary',
  'contentinfo', 'definition', 'deletion', 'dialog', 'document', 'emphasis', 'feed',
  'figure', 'form', 'generic', 'grid', 'gridcell', 'group', 'heading', 'img', 'insertion',
  'link', 'list', 'listbox', 'listitem', 'log', 'main', 'marquee', 'math', 'menu',
  'menubar', 'menuitem', 'menuitemcheckbox', 'menuitemradio', 'meter', 'navigation',
  'none', 'note', 'option', 'paragraph', 'presentation', 'progressbar', 'radio',
  'radiogroup', 'region', 'row', 'rowgroup', 'rowheader', 'scrollbar', 'search',
  'searchbox', 'separator', 'slider', 'spinbutton', 'status', 'strong', 'subscript',
  'superscript', 'switch', 'tab', 'table', 'tablist', 'tabpanel', 'term', 'textbox',
  'time', 'timer', 'toolbar', 'tooltip', 'tree', 'treegrid', 'treeitem',
]);

/** Roles removed or discouraged in WAI-ARIA 1.2 */
const DEPRECATED_ROLES = new Set(['directory', 'doc-biblioentry', 'doc-endnote']);

/**
 * ARIA states and properties. Anything `aria-*` outside this list is a typo:
 * browsers do not warn, they simply ignore it.
 */
const VALID_ARIA_ATTRS = new Set([
  'aria-activedescendant', 'aria-atomic', 'aria-autocomplete', 'aria-braillelabel',
  'aria-brailleroledescription', 'aria-busy', 'aria-checked', 'aria-colcount',
  'aria-colindex', 'aria-colindextext', 'aria-colspan', 'aria-controls', 'aria-current',
  'aria-describedby', 'aria-description', 'aria-details', 'aria-disabled',
  'aria-dropeffect', 'aria-errormessage', 'aria-expanded', 'aria-flowto', 'aria-grabbed',
  'aria-haspopup', 'aria-hidden', 'aria-invalid', 'aria-keyshortcuts', 'aria-label',
  'aria-labelledby', 'aria-level', 'aria-live', 'aria-modal', 'aria-multiline',
  'aria-multiselectable', 'aria-orientation', 'aria-owns', 'aria-placeholder',
  'aria-posinset', 'aria-pressed', 'aria-readonly', 'aria-relevant', 'aria-required',
  'aria-roledescription', 'aria-rowcount', 'aria-rowindex', 'aria-rowindextext',
  'aria-rowspan', 'aria-selected', 'aria-setsize', 'aria-sort', 'aria-valuemax',
  'aria-valuemin', 'aria-valuenow', 'aria-valuetext',
]);

/** Attributes whose value must be a boolean-ish token */
const BOOLEAN_ARIA = new Set([
  'aria-atomic', 'aria-busy', 'aria-disabled', 'aria-hidden', 'aria-modal',
  'aria-multiline', 'aria-multiselectable', 'aria-readonly', 'aria-required',
]);

/**
 * Rule: Validate ARIA roles and attributes
 *
 * Covers the failure mode where ARIA is present but inert — a misspelled
 * attribute or an invented role is silently discarded, so the markup looks
 * accessible while behaving as though it carried no ARIA at all.
 */
export const ariaValidRule = defineRule({
  id: 'a11y-aria-valid',
  name: 'Valid ARIA Roles and Attributes',
  description: 'Checks that ARIA roles exist and aria-* attributes are spelled correctly',
  category: 'a11y',
  weight: 5,
  run: (context: AuditContext) => {
    const { $, url } = context;

    const issues: { problem: string; detail: string }[] = [];

    $('[role]').each((_, el) => {
      const raw = $(el).attr('role')?.trim().toLowerCase();
      if (!raw) return;
      // The role attribute takes a space-separated fallback list.
      for (const role of raw.split(/\s+/)) {
        if (DEPRECATED_ROLES.has(role)) {
          issues.push({ problem: 'deprecated-role', detail: role });
        } else if (!VALID_ROLES.has(role)) {
          issues.push({ problem: 'invalid-role', detail: role });
        }
      }
    });

    $('*').each((_, el) => {
      const attribs = (el as { attribs?: Record<string, string> }).attribs;
      if (!attribs) return;
      for (const [name, value] of Object.entries(attribs)) {
        if (!name.startsWith('aria-')) continue;
        if (!VALID_ARIA_ATTRS.has(name)) {
          issues.push({ problem: 'invalid-attribute', detail: name });
          continue;
        }
        if (BOOLEAN_ARIA.has(name) && !['true', 'false', ''].includes(value.trim().toLowerCase())) {
          issues.push({ problem: 'invalid-value', detail: `${name}="${value}"` });
        }
      }
    });

    const details = { url, issues: issues.slice(0, 25), total: issues.length };

    if (issues.length > 0) {
      return fail(
        'a11y-aria-valid',
        `${issues.length} invalid ARIA role(s) or attribute(s) found — these are ignored by assistive technology`,
        details
      );
    }

    return pass('a11y-aria-valid', 'ARIA roles and attributes are valid', details);
  },
});
