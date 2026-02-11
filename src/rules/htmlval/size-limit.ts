import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, fail } from '../define-rule.js';

/**
 * Rule: Check HTML document size
 *
 * Extremely large HTML documents increase download time, parsing time, and
 * memory usage. Search engine crawlers may also truncate very large pages,
 * missing content and links near the end of the document.
 */

const WARN_THRESHOLD_BYTES = 250 * 1024; // 250 KB
const FAIL_THRESHOLD_BYTES = 500 * 1024; // 500 KB

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
