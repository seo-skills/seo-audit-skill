import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn } from '../define-rule.js';

/**
 * Thresholds for inline JavaScript minification check
 */
const THRESHOLDS = {
  /** Minimum bytes of inline JS before we check minification */
  minBytesToCheck: 500,
  /** Whitespace ratio above this value suggests unminified JS */
  whitespaceRatio: 0.15,
};

/**
 * Calculate the whitespace ratio in a string.
 * Counts newlines, consecutive spaces (>1), and tabs as wasteful whitespace.
 */
function calculateWhitespaceRatio(text: string): number {
  if (text.length === 0) return 0;

  const newlineCount = (text.match(/\n/g) || []).length;
  const extraSpaces = (text.match(/ {2,}/g) || []).reduce((sum, m) => sum + m.length - 1, 0);
  const tabCount = (text.match(/\t/g) || []).length;

  const wastedChars = newlineCount + extraSpaces + tabCount;
  return wastedChars / text.length;
}

/**
 * Check for multi-line comments that should be stripped during minification.
 */
function countBlockCommentBytes(text: string): number {
  const comments = text.match(/\/\*[\s\S]*?\*\//g) || [];
  return comments.reduce((sum, c) => sum + c.length, 0);
}

/**
 * Rule: Check if inline JavaScript appears to be minified
 *
 * Unminified inline JavaScript wastes bytes in the HTML document.
 * Minification strips whitespace, comments, and shortens identifiers
 * without changing behavior. Multi-line comments (block comments)
 * are a strong signal of unminified code.
 */
export const minifyJsRule = defineRule({
  id: 'perf-minify-js',
  name: 'Minify Inline JS',
  description: 'Checks if inline JavaScript in <script> tags appears to be minified',
  category: 'perf',
  weight: 5,
  run: (context: AuditContext) => {
    const { $ } = context;

    let totalInlineJs = '';
    let scriptTagCount = 0;

    // Only check inline scripts (without src attribute)
    $('script:not([src])').each((_, el) => {
      const content = $(el).html() || '';
      // Skip JSON-LD and other non-JS script types
      const type = $(el).attr('type') || '';
      if (type && type !== 'text/javascript' && type !== 'module' && type !== 'application/javascript') {
        return;
      }
      if (content.trim().length > 0) {
        totalInlineJs += content;
        scriptTagCount++;
      }
    });

    const totalBytes = Buffer.byteLength(totalInlineJs, 'utf8');

    const details: Record<string, unknown> = {
      scriptTagCount,
      totalBytes,
      thresholds: THRESHOLDS,
    };

    // Not enough inline JS to warrant checking
    if (totalBytes <= THRESHOLDS.minBytesToCheck) {
      return pass(
        'perf-minify-js',
        scriptTagCount === 0
          ? 'No inline JavaScript found'
          : `Inline JavaScript is minimal (${totalBytes} bytes across ${scriptTagCount} <script> tag(s))`,
        details
      );
    }

    const whitespaceRatio = calculateWhitespaceRatio(totalInlineJs);
    const blockCommentBytes = countBlockCommentBytes(totalInlineJs);

    details.whitespaceRatio = Math.round(whitespaceRatio * 1000) / 1000;
    details.blockCommentBytes = blockCommentBytes;

    const hasBlockComments = blockCommentBytes > 0;
    const isUnminified = whitespaceRatio > THRESHOLDS.whitespaceRatio || hasBlockComments;

    if (isUnminified) {
      const reasons: string[] = [];
      if (whitespaceRatio > THRESHOLDS.whitespaceRatio) {
        reasons.push(`~${Math.round(whitespaceRatio * 100)}% whitespace`);
      }
      if (hasBlockComments) {
        reasons.push(`${blockCommentBytes} bytes in block comments`);
      }
      const estimatedSavings = Math.round(totalBytes * whitespaceRatio) + blockCommentBytes;
      return warn(
        'perf-minify-js',
        `Inline JavaScript appears unminified (${totalBytes} bytes, ${reasons.join(', ')}) — minification could save ~${estimatedSavings} bytes`,
        { ...details, estimatedSavingsBytes: estimatedSavings }
      );
    }

    return pass(
      'perf-minify-js',
      `Inline JavaScript is minified (${totalBytes} bytes, ${Math.round(whitespaceRatio * 100)}% whitespace)`,
      details
    );
  },
});
