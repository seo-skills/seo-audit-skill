import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn } from '../define-rule.js';

interface SmallTarget {
  /** Element description */
  element: string;
  /** Issue description */
  issue: string;
}

/**
 * Rule: Touch Targets
 *
 * Checks for minimum touch target sizing hints in CSS, against 44x44 CSS
 * pixels: WCAG 2.5.5 Target Size (Enhanced, Level AAA), and Apple's and
 * Google's touch guidance. The Level AA minimum, 2.5.8, is 24x24.
 *
 * This rule checks for:
 * - Inline styles with small dimensions on interactive elements
 * - CSS that may create small touch targets
 * - Icon-only buttons without adequate sizing
 *
 * Note: Full touch target analysis requires visual rendering.
 * This provides heuristic detection based on available HTML/CSS.
 */
export const touchTargetsRule = defineRule({
  id: 'a11y-touch-targets',
  name: 'Touch Targets',
  description: 'Checks for minimum touch target sizing hints',
  category: 'a11y',
  weight: 6,
  run: (context: AuditContext) => {
    const { $ } = context;

    const issues: SmallTarget[] = [];

    // Check interactive elements with inline size styles
    const interactiveSelector =
      'a[href], button, input:not([type="hidden"]), select, textarea, [role="button"], [role="link"], [tabindex]:not([tabindex="-1"])';

    $(interactiveSelector).each((_, el) => {
      const $el = $(el);
      const style = $el.attr('style') || '';

      // Check for explicit small dimensions
      const widthMatch = style.match(/width\s*:\s*(\d+)(px|em|rem)?/i);
      const heightMatch = style.match(/height\s*:\s*(\d+)(px|em|rem)?/i);

      if (widthMatch || heightMatch) {
        const width = widthMatch ? parseSize(widthMatch[1], widthMatch[2]) : 44;
        const height = heightMatch ? parseSize(heightMatch[1], heightMatch[2]) : 44;

        if (width < 44 || height < 44) {
          const tag = el.tagName?.toLowerCase() || 'element';
          const text = $el.text().trim().slice(0, 20);
          const id = $el.attr('id');

          issues.push({
            element: id ? `${tag}#${id}` : text ? `${tag}: "${text}"` : tag,
            issue: `Small dimensions: ${Math.round(width)}x${Math.round(height)}px (min 44x44)`,
          });
        }
      }

      // Check for icon-only buttons that might be too small
      const hasNoText = !$el.text().trim();
      const hasIcon = $el.find('svg, i, .icon, [class*="icon"]').length > 0;
      const hasImage = $el.find('img').length > 0;

      if (hasNoText && (hasIcon || hasImage)) {
        // Check if parent has size constraints
        const padding = style.match(/padding\s*:\s*(\d+)/i);
        if (padding && parseInt(padding[1], 10) < 10) {
          const tag = el.tagName?.toLowerCase() || 'element';
          const ariaLabel = $el.attr('aria-label') || 'unlabeled';

          issues.push({
            element: `${tag} (${ariaLabel})`,
            issue: 'Icon-only button with minimal padding may have small touch target',
          });
        }
      }
    });

    // Check style tags for rules that size links or buttons small
    $('style').each((_, el) => {
      const css = $(el).html() || '';

      for (const rule of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        const target = rule[1].split(',').map((s) => s.trim()).find(isInteractiveSubject);
        if (!target) continue;

        for (const prop of rule[2].matchAll(/(?<![-\w])(width|height)\s*:\s*(\d+)px/gi)) {
          const dimension = parseInt(prop[2], 10);
          if (dimension > 0 && dimension < 44) {
            issues.push({
              element: target,
              issue: `CSS sets small ${prop[1].toLowerCase()} (${dimension}px) on interactive elements`,
            });
            break;
          }
        }
      }
    });

    // Check for very small images used as links
    $('a img, button img').each((_, el) => {
      const $img = $(el);
      const width = $img.attr('width');
      const height = $img.attr('height');

      if (width && height) {
        const w = parseInt(width, 10);
        const h = parseInt(height, 10);

        if ((w > 0 && w < 44) || (h > 0 && h < 44)) {
          const alt = $img.attr('alt') || 'image';
          issues.push({
            element: `img: ${alt}`,
            issue: `Image link/button is ${w}x${h}px (min 44x44)`,
          });
        }
      }
    });

    if (issues.length === 0) {
      return pass('a11y-touch-targets', 'No obvious touch target size issues detected', {
        note: 'Full touch target analysis requires visual rendering',
      });
    }

    return warn(
      'a11y-touch-targets',
      `Found ${issues.length} potential touch target sizing issue(s)`,
      {
        issues: issues.slice(0, 10),
        totalIssues: issues.length,
        recommendation: 'Ensure interactive elements are at least 44x44 CSS pixels',
        wcagReference: 'WCAG 2.2 SC 2.5.5 Target Size (Enhanced, Level AAA): 44x44; SC 2.5.8 (Level AA): 24x24',
      }
    );
  },
});

/**
 * Whether a selector's subject (its last compound) is a link or button
 * itself. A pseudo-element such as ::before is a decoration, not the target,
 * and a class merely containing the letter "a" is not a link.
 */
function isInteractiveSubject(selector: string): boolean {
  const subject = selector.split(/[\s>+~]+/).filter(Boolean).pop() ?? '';
  if (/::?(before|after|placeholder|marker|selection|first-line|first-letter)\b/i.test(subject)) {
    return false;
  }
  return (
    /^(a|button)(?![\w-])/i.test(subject) ||
    /\.btn(?![\w-])/i.test(subject) ||
    /\[role=["']?button/i.test(subject)
  );
}

/**
 * Parse CSS size value to pixels (approximation)
 */
function parseSize(value: string, unit?: string): number {
  const num = parseInt(value, 10);

  switch (unit?.toLowerCase()) {
    case 'em':
    case 'rem':
      return num * 16; // Approximate
    case 'px':
    default:
      return num;
  }
}
