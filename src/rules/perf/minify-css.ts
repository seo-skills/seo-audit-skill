import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn } from '../define-rule.js';

/**
 * Thresholds for inline CSS minification check
 */
const THRESHOLDS = {
  /** Minimum bytes of inline CSS before we check minification */
  minBytesToCheck: 500,
  /** Whitespace ratio above this value suggests unminified CSS */
  whitespaceRatio: 0.15,
};

/**
 * Calculate the whitespace ratio in a string.
 * Counts newlines, consecutive spaces (>1), and tabs as wasteful whitespace.
 */
function calculateWhitespaceRatio(text: string): number {
  if (text.length === 0) return 0;

  // Count newlines
  const newlineCount = (text.match(/\n/g) || []).length;
  // Count runs of 2+ spaces (the extra spaces beyond the first)
  const extraSpaces = (text.match(/ {2,}/g) || []).reduce((sum, m) => sum + m.length - 1, 0);
  // Count tabs
  const tabCount = (text.match(/\t/g) || []).length;

  const wastedChars = newlineCount + extraSpaces + tabCount;
  return wastedChars / text.length;
}

/**
 * Rule: Check if inline CSS appears to be minified
 *
 * Unminified inline CSS wastes bytes in the HTML document, increasing
 * page weight and slowing initial render. Minification removes unnecessary
 * whitespace, comments, and formatting without changing behavior.
 */
export const minifyCssRule = defineRule({
  id: 'perf-minify-css',
  name: 'Minify Inline CSS',
  description: 'Checks if inline CSS in <style> tags appears to be minified',
  category: 'perf',
  weight: 5,
  run: (context: AuditContext) => {
    const { $ } = context;

    let totalInlineCss = '';
    let styleTagCount = 0;

    $('style').each((_, el) => {
      const content = $(el).html() || '';
      if (content.trim().length > 0) {
        totalInlineCss += content;
        styleTagCount++;
      }
    });

    const totalBytes = Buffer.byteLength(totalInlineCss, 'utf8');

    const details: Record<string, unknown> = {
      styleTagCount,
      totalBytes,
      thresholds: THRESHOLDS,
    };

    // Not enough inline CSS to warrant checking
    if (totalBytes <= THRESHOLDS.minBytesToCheck) {
      return pass(
        'perf-minify-css',
        styleTagCount === 0
          ? 'No inline CSS found'
          : `Inline CSS is minimal (${totalBytes} bytes across ${styleTagCount} <style> tag(s))`,
        details
      );
    }

    const whitespaceRatio = calculateWhitespaceRatio(totalInlineCss);

    details.whitespaceRatio = Math.round(whitespaceRatio * 1000) / 1000;

    if (whitespaceRatio > THRESHOLDS.whitespaceRatio) {
      const estimatedSavings = Math.round(totalBytes * whitespaceRatio);
      return warn(
        'perf-minify-css',
        `Inline CSS appears unminified (${totalBytes} bytes, ~${Math.round(whitespaceRatio * 100)}% whitespace) — minification could save ~${estimatedSavings} bytes`,
        { ...details, estimatedSavingsBytes: estimatedSavings }
      );
    }

    return pass(
      'perf-minify-css',
      `Inline CSS is minified (${totalBytes} bytes, ${Math.round(whitespaceRatio * 100)}% whitespace)`,
      details
    );
  },
});
