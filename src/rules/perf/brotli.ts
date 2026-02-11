import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn } from '../define-rule.js';

/**
 * Rule: Check if Brotli compression is used
 *
 * Brotli (br) typically provides 15-20% better compression than gzip
 * for text-based assets, reducing transfer size and improving load time.
 * Supported by all modern browsers since 2017.
 */
export const brotliRule = defineRule({
  id: 'perf-brotli',
  name: 'Brotli Compression',
  description: 'Checks if Brotli compression is used instead of gzip for better compression',
  category: 'perf',
  weight: 5,
  run: (context: AuditContext) => {
    const encoding = (context.headers['content-encoding'] || '').toLowerCase().trim();

    const details: Record<string, unknown> = {
      contentEncoding: encoding || 'none',
    };

    if (!encoding) {
      return warn(
        'perf-brotli',
        'No compression detected — consider enabling Brotli for optimal transfer size',
        details
      );
    }

    const encodingParts = encoding.split(',').map((e) => e.trim());
    const usesBrotli = encodingParts.some((e) => e === 'br');

    if (usesBrotli) {
      return pass(
        'perf-brotli',
        'Brotli compression is active — optimal text compression',
        details
      );
    }

    const usesGzip = encodingParts.some((e) => e === 'gzip');

    if (usesGzip) {
      return warn(
        'perf-brotli',
        'Using gzip but not Brotli — Brotli gives ~15-20% better compression for text assets',
        { ...details, currentEncoding: 'gzip', recommendation: 'br' }
      );
    }

    return warn(
      'perf-brotli',
      `Using "${encoding}" compression — consider Brotli for better compression ratios`,
      details
    );
  },
});
