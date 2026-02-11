import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, fail } from '../define-rule.js';

/**
 * HTML document size thresholds in bytes
 */
const THRESHOLDS = {
  /** HTML < 100KB is optimal */
  good: 100 * 1024,
  /** HTML 100-300KB is acceptable */
  warning: 300 * 1024,
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
 * Rule: Check HTML document size (page weight)
 *
 * Large HTML documents increase download time, memory usage, and
 * DOM parsing overhead. This rule measures the main HTML document
 * size transferred to the browser. Heavy HTML often indicates
 * inline resources that should be externalized, server-side
 * rendering bloat, or excessive DOM content.
 */
export const pageWeightRule = defineRule({
  id: 'perf-page-weight',
  name: 'Page Weight',
  description: 'Checks HTML document size against recommended thresholds',
  category: 'perf',
  weight: 8,
  run: (context: AuditContext) => {
    const { $, html } = context;
    const htmlBytes = Buffer.byteLength(html, 'utf8');

    // Count external resource references for informational purposes
    const externalScripts = $('script[src]').length;
    const externalStylesheets = $('link[rel="stylesheet"]').length;
    const imageCount = $('img').length;

    const details: Record<string, unknown> = {
      htmlBytes,
      htmlSize: formatBytes(htmlBytes),
      externalScripts,
      externalStylesheets,
      imageCount,
      thresholds: {
        good: formatBytes(THRESHOLDS.good),
        warning: formatBytes(THRESHOLDS.warning),
      },
    };

    if (htmlBytes > THRESHOLDS.warning) {
      return fail(
        'perf-page-weight',
        `HTML document is ${formatBytes(htmlBytes)} (recommended: <${formatBytes(THRESHOLDS.good)}) — consider reducing inline content, splitting pages, or lazy loading`,
        details
      );
    }

    if (htmlBytes > THRESHOLDS.good) {
      return warn(
        'perf-page-weight',
        `HTML document is ${formatBytes(htmlBytes)} (recommended: <${formatBytes(THRESHOLDS.good)}) — consider externalizing inline resources`,
        details
      );
    }

    return pass(
      'perf-page-weight',
      `HTML document is ${formatBytes(htmlBytes)} — within optimal range`,
      details
    );
  },
});
