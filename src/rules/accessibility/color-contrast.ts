import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn } from '../define-rule.js';

interface ContrastIssue {
  /** Element selector/description */
  element: string;
  /** Issue description */
  issue: string;
}

/**
 * Rule: Color Contrast
 *
 * Checks for potential color contrast issues by analyzing inline styles
 * and CSS classes that may indicate low contrast combinations.
 *
 * Note: Full WCAG contrast ratio calculation requires visual rendering.
 * This rule provides heuristic detection based on:
 * - Inline color/background-color styles with similar values
 * - Known problematic color combinations
 * - Text on background images without fallback
 */
export const colorContrastRule = defineRule({
  id: 'a11y-color-contrast',
  name: 'Color Contrast',
  description: 'Checks for potential color contrast issues',
  category: 'accessibility',
  weight: 8,
  run: (context: AuditContext) => {
    const { $ } = context;

    const issues: ContrastIssue[] = [];

    // Check for text elements with inline styles that may have low contrast
    $('[style*="color"]').each((_, el) => {
      const $el = $(el);
      const style = $el.attr('style') || '';

      // Extract color values
      const colorMatch = style.match(/(?:^|;)\s*color\s*:\s*([^;]+)/i);
      const bgMatch = style.match(/background(?:-color)?\s*:\s*([^;]+)/i);

      if (colorMatch && bgMatch) {
        const color = colorMatch[1].trim().toLowerCase();
        const bg = bgMatch[1].trim().toLowerCase();

        // Check for obviously problematic combinations
        if (isLowContrastPair(color, bg)) {
          const tag = el.tagName?.toLowerCase() || 'element';
          const id = $el.attr('id');
          const selector = id ? `${tag}#${id}` : tag;

          issues.push({
            element: selector,
            issue: `Potential low contrast: ${color} on ${bg}`,
          });
        }
      }
    });

    // Check for light gray text (common issue)
    $('[style*="color"]').each((_, el) => {
      const $el = $(el);
      const style = $el.attr('style') || '';
      const colorMatch = style.match(/(?:^|;)\s*color\s*:\s*([^;]+)/i);

      if (colorMatch) {
        const color = colorMatch[1].trim().toLowerCase();
        if (isLightGray(color)) {
          const text = $el.text().trim();
          if (text.length > 0 && text.length < 100) {
            issues.push({
              element: `Text: "${text.slice(0, 30)}..."`,
              issue: `Light gray text (${color}) may have insufficient contrast`,
            });
          }
        }
      }
    });

    // Check for text on background images without fallback color
    $('[style*="background-image"]').each((_, el) => {
      const $el = $(el);
      const style = $el.attr('style') || '';
      const text = $el.text().trim();

      if (text.length > 0 && !style.includes('background-color')) {
        const tag = el.tagName?.toLowerCase() || 'element';
        issues.push({
          element: tag,
          issue: 'Text on background image without fallback background-color',
        });
      }
    });

    if (issues.length === 0) {
      return pass('a11y-color-contrast', 'No obvious color contrast issues detected', {
        note: 'Full WCAG contrast checking requires visual rendering',
      });
    }

    return warn('a11y-color-contrast', `Found ${issues.length} potential contrast issue(s)`, {
      issues: issues.slice(0, 10),
      totalIssues: issues.length,
      note: 'These are heuristic detections; verify with a visual contrast checker',
    });
  },
});

/**
 * Check if two colors are a known low-contrast pair
 */
function isLowContrastPair(color: string, bg: string): boolean {
  // Normalize colors
  const c = normalizeColor(color);
  const b = normalizeColor(bg);

  // Known problematic pairs
  const lowContrastPairs = [
    ['white', 'white'],
    ['black', 'black'],
    ['gray', 'gray'],
    ['lightgray', 'white'],
    ['silver', 'white'],
    ['yellow', 'white'],
    ['cyan', 'white'],
    ['lime', 'white'],
    ['darkgray', 'black'],
    ['navy', 'black'],
    ['darkblue', 'black'],
  ];

  for (const [a, b2] of lowContrastPairs) {
    if ((c.includes(a) && b.includes(b2)) || (c.includes(b2) && b.includes(a))) {
      return true;
    }
  }

  return false;
}

/**
 * Check if color is a light gray that may have contrast issues
 */
function isLightGray(color: string): boolean {
  const c = color.toLowerCase();

  // Named light grays
  if (['lightgray', 'lightgrey', 'silver', 'gainsboro'].includes(c)) {
    return true;
  }

  // Hex light grays (#aaa, #bbb, #ccc, #ddd, #eee)
  if (/^#[a-f]{3}$/i.test(c) || /^#[a-f]{6}$/i.test(c)) {
    return true;
  }

  // RGB light grays
  const rgbMatch = c.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/);
  if (rgbMatch) {
    const [, r, g, b] = rgbMatch.map(Number);
    // Light gray: all components similar and > 150
    if (Math.abs(r - g) < 20 && Math.abs(g - b) < 20 && r > 150) {
      return true;
    }
  }

  return false;
}

function normalizeColor(color: string): string {
  return color.toLowerCase().replace(/\s+/g, '');
}
