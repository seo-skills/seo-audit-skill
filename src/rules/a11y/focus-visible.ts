import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, fail } from '../define-rule.js';

/**
 * Rule: Focus Visible
 *
 * Checks for CSS that may remove or hide focus indicators,
 * making keyboard navigation difficult.
 *
 * Problematic patterns:
 * - outline: none / outline: 0 without alternative focus styles
 * - :focus { outline: none } in stylesheets
 */
export const focusVisibleRule = defineRule({
  id: 'a11y-focus-visible',
  name: 'Focus Visible',
  description: 'Checks for focus indicator styles',
  category: 'a11y',
  weight: 8,
  run: (context: AuditContext) => {
    const { $, html } = context;

    const issues: string[] = [];
    let hasOutlineNone = false;
    let hasFocusVisibleSupport = false;

    // Check inline styles for outline: none
    $('[style*="outline"]').each((_, el) => {
      const $el = $(el);
      const style = $el.attr('style') || '';

      if (/outline\s*:\s*(none|0)/i.test(style)) {
        const tag = el.tagName?.toLowerCase() || 'element';
        const id = $el.attr('id');
        const selector = id ? `${tag}#${id}` : tag;

        // Check if element is interactive
        if (isInteractive($el)) {
          issues.push(`${selector} has outline:none inline style`);
          hasOutlineNone = true;
        }
      }
    });

    // Check style tags for problematic focus styles
    $('style').each((_, el) => {
      const cssContent = $(el).html() || '';

      // Check for outline: none on interactive elements
      if (/:focus\s*\{[^}]*outline\s*:\s*(none|0)/i.test(cssContent)) {
        hasOutlineNone = true;

        // But check if there's an alternative focus style
        if (/:focus\s*\{[^}]*(box-shadow|border|background)/i.test(cssContent)) {
          // Has alternative, that's okay
        } else {
          issues.push('Stylesheet removes focus outline without alternative');
        }
      }

      // Check for :focus-visible support (modern approach)
      if (/:focus-visible/i.test(cssContent)) {
        hasFocusVisibleSupport = true;
      }

      // Global * { outline: none } is very bad
      if (/\*\s*\{[^}]*outline\s*:\s*(none|0)/i.test(cssContent)) {
        issues.push('Global selector removes all outlines');
        hasOutlineNone = true;
      }

      // a, button, input etc with outline: none
      if (/(a|button|input|select|textarea)\s*\{[^}]*outline\s*:\s*(none|0)/i.test(cssContent)) {
        issues.push('Interactive element styles remove focus outline');
        hasOutlineNone = true;
      }
    });

    // Check for tabindex without visible focus management
    const customTabindex = $('[tabindex]:not([tabindex="-1"])').length;

    // Check link tags for external stylesheets (can't analyze, but note it)
    const externalStyles = $('link[rel="stylesheet"]').length;

    if (issues.length === 0 && !hasOutlineNone) {
      return pass('a11y-focus-visible', 'No focus indicator issues detected', {
        hasFocusVisibleSupport,
        customTabindexElements: customTabindex,
        externalStylesheets: externalStyles,
        note: externalStyles > 0 ? 'External stylesheets not analyzed' : undefined,
      });
    }

    // If using :focus-visible, that's good even if outline:none exists
    if (hasFocusVisibleSupport && issues.length <= 1) {
      return warn(
        'a11y-focus-visible',
        'Focus outline removed but :focus-visible detected',
        {
          issues,
          hasFocusVisibleSupport: true,
          recommendation: 'Ensure :focus-visible provides clear focus indicators',
        }
      );
    }

    if (issues.length > 3) {
      return fail(
        'a11y-focus-visible',
        `Found ${issues.length} focus indicator issues`,
        {
          issues: issues.slice(0, 10),
          totalIssues: issues.length,
        }
      );
    }

    return warn(
      'a11y-focus-visible',
      `Found ${issues.length} potential focus indicator issue(s)`,
      {
        issues,
        recommendation: 'Ensure all interactive elements have visible focus indicators',
      }
    );
  },
});

function isInteractive($el: cheerio.Cheerio<cheerio.Element>): boolean {
  const tag = $el.prop('tagName')?.toLowerCase();
  const role = $el.attr('role');

  const interactiveTags = ['a', 'button', 'input', 'select', 'textarea'];
  const interactiveRoles = ['button', 'link', 'checkbox', 'radio', 'tab', 'menuitem'];

  if (interactiveTags.includes(tag || '')) {
    return true;
  }

  if (role && interactiveRoles.includes(role)) {
    return true;
  }

  // Has tabindex
  const tabindex = $el.attr('tabindex');
  if (tabindex && tabindex !== '-1') {
    return true;
  }

  return false;
}
