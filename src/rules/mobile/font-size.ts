import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, fail } from '../define-rule.js';

interface FontIssue {
  /** Element or CSS selector */
  location: string;
  /** Issue description */
  issue: string;
  /** Actual value found */
  value: string;
}

/**
 * Rule: Mobile Font Size
 *
 * Checks that text maintains readable font sizes for mobile users:
 * - Body text should be at least 16px for readability without zooming
 * - Google's mobile-friendly test flags font sizes under 12px
 * - Relative units (rem, em, %) are preferred over fixed pixels
 * - Line height should be at least 1.5 for optimal readability
 *
 * Static analysis checks:
 * - Inline styles with small font-size values
 * - CSS declarations with fixed small font sizes
 * - Line-height values that are too tight
 */
export const fontSizeRule = defineRule({
  id: 'mobile-font-size',
  name: 'Mobile Font Size',
  description: 'Checks for readable font sizes on mobile devices',
  category: 'mobile',
  weight: 15,
  run: (context: AuditContext) => {
    const { $ } = context;

    const issues: FontIssue[] = [];
    let smallFontCount = 0;
    let tightLineHeightCount = 0;

    // Check inline styles on text elements
    const textElements = 'p, span, div, li, td, th, label, a, button';

    $(textElements).each((_, el) => {
      const $el = $(el);
      const style = $el.attr('style') || '';

      // Check font-size
      const fontMatch = style.match(/font-size\s*:\s*(\d+(?:\.\d+)?)(px|em|rem|pt|%)?/i);
      if (fontMatch) {
        const size = parseFloat(fontMatch[1]);
        const unit = fontMatch[2]?.toLowerCase() || 'px';

        const pxSize = convertToPixels(size, unit);

        if (pxSize < 12) {
          smallFontCount++;
          const tag = el.tagName?.toLowerCase() || 'element';
          const text = $el.text().trim().slice(0, 20);
          issues.push({
            location: text ? `${tag}: "${text}..."` : tag,
            issue: 'Font size below 12px is too small for mobile',
            value: `${size}${unit}`,
          });
        } else if (pxSize < 16) {
          smallFontCount++;
          const tag = el.tagName?.toLowerCase() || 'element';
          const text = $el.text().trim().slice(0, 20);
          issues.push({
            location: text ? `${tag}: "${text}..."` : tag,
            issue: 'Font size below 16px may require zooming on mobile',
            value: `${size}${unit}`,
          });
        }
      }

      // Check line-height
      const lineMatch = style.match(/line-height\s*:\s*(\d+(?:\.\d+)?)(px|em|rem|%)?/i);
      if (lineMatch) {
        const lineValue = parseFloat(lineMatch[1]);
        const lineUnit = lineMatch[2]?.toLowerCase();

        // Unitless or em/rem values below 1.5 are too tight
        if (!lineUnit || lineUnit === 'em' || lineUnit === 'rem') {
          if (lineValue < 1.2) {
            tightLineHeightCount++;
            const tag = el.tagName?.toLowerCase() || 'element';
            issues.push({
              location: tag,
              issue: 'Line height below 1.2 reduces readability',
              value: lineMatch[0],
            });
          }
        }
      }
    });

    // Check style tags for problematic patterns
    $('style').each((_, el) => {
      const css = $(el).html() || '';

      // Find font-size declarations with small values
      const smallFontPattern = /font-size\s*:\s*(\d+(?:\.\d+)?)(px|pt)\s*[;}\n]/gi;
      let match;

      while ((match = smallFontPattern.exec(css)) !== null) {
        const size = parseFloat(match[1]);
        const unit = match[2].toLowerCase();
        const pxSize = convertToPixels(size, unit);

        if (pxSize < 12) {
          issues.push({
            location: 'CSS stylesheet',
            issue: 'CSS declares font size below 12px',
            value: `${size}${unit}`,
          });
          smallFontCount++;
        }
      }

      // Check for !important on very small sizes
      const importantSmall = /font-size\s*:\s*(\d+)(px|pt)\s*!important/gi;
      while ((match = importantSmall.exec(css)) !== null) {
        const size = parseInt(match[1], 10);
        if (size < 12) {
          issues.push({
            location: 'CSS stylesheet',
            issue: 'Small font size with !important cannot be overridden',
            value: `${size}${match[2]} !important`,
          });
        }
      }

      // Check line-height values
      const tightLinePattern = /line-height\s*:\s*(0\.\d+|1(?:\.[0-4])?)\s*[;}\n]/gi;
      while ((match = tightLinePattern.exec(css)) !== null) {
        const value = parseFloat(match[1]);
        if (value < 1.2) {
          issues.push({
            location: 'CSS stylesheet',
            issue: 'Line height below 1.2 reduces mobile readability',
            value: match[1],
          });
          tightLineHeightCount++;
        }
      }
    });

    // Check body/html for base font size
    const bodyStyle = $('body').attr('style') || '';
    const htmlStyle = $('html').attr('style') || '';
    const baseStyle = bodyStyle + htmlStyle;

    const baseFontMatch = baseStyle.match(/font-size\s*:\s*(\d+(?:\.\d+)?)(px|pt)/i);
    if (baseFontMatch) {
      const size = parseFloat(baseFontMatch[1]);
      const pxSize = convertToPixels(size, baseFontMatch[2]?.toLowerCase() || 'px');
      if (pxSize < 14) {
        issues.push({
          location: 'Base font size (body/html)',
          issue: 'Base font size below 14px affects all text',
          value: baseFontMatch[0],
        });
      }
    }

    // Evaluate results
    if (issues.length === 0) {
      return pass(
        'mobile-font-size',
        'No mobile font size issues detected',
        { note: 'Static analysis - verify on actual mobile device' }
      );
    }

    const criticalIssues = issues.filter(i =>
      i.issue.includes('below 12px') || i.issue.includes('!important')
    );

    if (criticalIssues.length > 0) {
      return fail(
        'mobile-font-size',
        `Found ${criticalIssues.length} critical font size issue(s) below 12px`,
        {
          issues: issues.slice(0, 10),
          totalIssues: issues.length,
          smallFontCount,
          tightLineHeightCount,
          recommendation: 'Use minimum 16px for body text, 12px absolute minimum',
        }
      );
    }

    return warn(
      'mobile-font-size',
      `Found ${issues.length} mobile font size issue(s)`,
      {
        issues: issues.slice(0, 10),
        totalIssues: issues.length,
        smallFontCount,
        tightLineHeightCount,
        recommendation: 'Use 16px or larger for body text; prefer relative units (rem, em)',
      }
    );
  },
});

/**
 * Convert font size to approximate pixel value
 */
function convertToPixels(value: number, unit: string): number {
  switch (unit) {
    case 'em':
    case 'rem':
      return value * 16;
    case 'pt':
      return value * 1.333; // 1pt is approximately 1.333px
    case '%':
      return (value / 100) * 16;
    case 'px':
    default:
      return value;
  }
}
