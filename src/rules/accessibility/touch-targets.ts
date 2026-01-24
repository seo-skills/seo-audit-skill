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
 * Checks for minimum touch target sizing hints in CSS.
 * WCAG 2.2 requires 44x44 CSS pixels for touch targets (Level AAA).
 * WCAG 2.1 recommends 44x44 pixels.
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
  category: 'accessibility',
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

    // Check style tags for patterns that create small targets
    $('style').each((_, el) => {
      const css = $(el).html() || '';

      // Check for button/link styles with small dimensions
      const smallButtonPattern =
        /(button|\.btn|a)[^{]*\{[^}]*(width\s*:\s*(\d+)px|height\s*:\s*(\d+)px)/gi;
      let match;

      while ((match = smallButtonPattern.exec(css)) !== null) {
        const dimension = parseInt(match[3] || match[4], 10);
        if (dimension > 0 && dimension < 44) {
          issues.push({
            element: match[1],
            issue: `CSS sets small dimension (${dimension}px) on interactive elements`,
          });
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
        wcagReference: 'WCAG 2.2 Success Criterion 2.5.8 (Level AAA)',
      }
    );
  },
});

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
