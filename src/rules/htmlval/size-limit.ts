import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, fail } from '../define-rule.js';

/**
 * Rule: Check HTML document size
 *
 * Extremely large HTML documents increase download time, parsing time, and
 * memory usage. Above roughly 2 MB, Googlebot may only crawl and index the
 * first part of the HTML, so content and links near the end of the document
 * can be missed entirely. Smaller documents still incur a performance
 * penalty, checked by the 250 KB / 500 KB thresholds below.
 */

const WARN_THRESHOLD_BYTES = 250 * 1024; // 250 KB
const FAIL_THRESHOLD_BYTES = 500 * 1024; // 500 KB
const CRAWL_CUTOFF_BYTES = 2 * 1024 * 1024; // ~2 MB

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(2)} MB`;
}

export const sizeLimitRule = defineRule({
  id: 'htmlval-size-limit',
  name: 'HTML Document Size',
  description: 'Checks that the HTML document size is within reasonable limits',
  category: 'htmlval',
  weight: 8,
  run: async (context: AuditContext) => {
    const sizeBytes = Buffer.byteLength(context.html, 'utf8');
    const sizeFormatted = formatBytes(sizeBytes);

    if (sizeBytes > CRAWL_CUTOFF_BYTES) {
      return fail(
        'htmlval-size-limit',
        `HTML document is ${sizeFormatted}, which exceeds the ~2 MB Googlebot crawl cutoff. Googlebot may only crawl and index the first part of the HTML, so content and links near the end of the document may be missed entirely`,
        { sizeBytes, sizeFormatted, threshold: '~2 MB' }
      );
    }

    if (sizeBytes > FAIL_THRESHOLD_BYTES) {
      return fail(
        'htmlval-size-limit',
        `HTML document is ${sizeFormatted}, which exceeds the 500 KB limit. Consider reducing inline styles, scripts, or splitting content`,
        { sizeBytes, sizeFormatted, threshold: '500 KB' }
      );
    }

    if (sizeBytes > WARN_THRESHOLD_BYTES) {
      return warn(
        'htmlval-size-limit',
        `HTML document is ${sizeFormatted}. Consider keeping it under 250 KB for optimal performance`,
        { sizeBytes, sizeFormatted, threshold: '250 KB' }
      );
    }

    return pass(
      'htmlval-size-limit',
      `HTML document size is ${sizeFormatted}`,
      { sizeBytes, sizeFormatted }
    );
  },
});
