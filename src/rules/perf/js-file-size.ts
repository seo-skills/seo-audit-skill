import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, fail } from '../define-rule.js';

/**
 * Inline JavaScript size thresholds in bytes
 */
const THRESHOLDS = {
  /** Inline JS < 50KB is optimal */
  good: 50 * 1024,
  /** Inline JS 50-150KB is acceptable */
  warning: 150 * 1024,
};

/**
 * Format bytes as a human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)}KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)}MB`;
}

/**
 * Rule: Check total inline JavaScript size
 *
 * Large amounts of inline JavaScript increase HTML document size,
 * prevent caching of script code, and block parsing. Inline scripts
 * cannot be cached independently by the browser, so every page load
 * re-downloads the same code. Consider externalizing large scripts.
 */
export const jsFileSizeRule = defineRule({
  id: 'perf-js-file-size',
  name: 'Inline JS Size',
  description: 'Checks total inline JavaScript size across all <script> tags',
  category: 'perf',
  weight: 5,
  run: (context: AuditContext) => {
    const { $ } = context;

    let totalBytes = 0;
    let inlineScriptCount = 0;
    let largestScriptBytes = 0;

    $('script:not([src])').each((_, el) => {
      const content = $(el).html() || '';
      // Skip non-JS script types (JSON-LD, templates, etc.)
      const type = $(el).attr('type') || '';
      if (type && type !== 'text/javascript' && type !== 'module' && type !== 'application/javascript') {
        return;
      }
      if (content.trim().length > 0) {
        const bytes = Buffer.byteLength(content, 'utf8');
        totalBytes += bytes;
        inlineScriptCount++;
        if (bytes > largestScriptBytes) {
          largestScriptBytes = bytes;
        }
      }
    });

    const details: Record<string, unknown> = {
      totalBytes,
      totalSize: formatBytes(totalBytes),
      inlineScriptCount,
      largestScriptBytes,
      largestScriptSize: formatBytes(largestScriptBytes),
      thresholds: {
        good: formatBytes(THRESHOLDS.good),
        warning: formatBytes(THRESHOLDS.warning),
      },
    };

    if (totalBytes > THRESHOLDS.warning) {
      return fail(
        'perf-js-file-size',
        `Total inline JavaScript is ${formatBytes(totalBytes)} across ${inlineScriptCount} script(s) (recommended: <${formatBytes(THRESHOLDS.good)}) — externalize large scripts for caching`,
        details
      );
    }

    if (totalBytes > THRESHOLDS.good) {
      return warn(
        'perf-js-file-size',
        `Total inline JavaScript is ${formatBytes(totalBytes)} across ${inlineScriptCount} script(s) (recommended: <${formatBytes(THRESHOLDS.good)}) — consider externalizing`,
        details
      );
    }

    return pass(
      'perf-js-file-size',
      inlineScriptCount === 0
        ? 'No inline JavaScript found'
        : `Inline JavaScript is ${formatBytes(totalBytes)} across ${inlineScriptCount} script(s) — within optimal range`,
      details
    );
  },
});
