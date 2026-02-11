import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn } from '../define-rule.js';

/**
 * Supported compression encodings
 */
const SUPPORTED_ENCODINGS = ['gzip', 'br', 'deflate', 'zstd'] as const;

/**
 * Rule: Check if response uses text compression
 *
 * Text compression (gzip, Brotli, deflate, zstd) significantly reduces
 * transfer size, improving page load time. Most modern servers and CDNs
 * support at least gzip; Brotli offers ~15-20% better compression.
 */
export const textCompressionRule = defineRule({
  id: 'perf-text-compression',
  name: 'Text Compression',
  description: 'Checks if the response uses text compression (gzip, br, deflate, zstd)',
  category: 'perf',
  weight: 8,
  run: (context: AuditContext) => {
    const encoding = (context.headers['content-encoding'] || '').toLowerCase().trim();

    const details: Record<string, unknown> = {
      contentEncoding: encoding || 'none',
      supportedEncodings: [...SUPPORTED_ENCODINGS],
    };

    if (!encoding) {
      return warn(
        'perf-text-compression',
        'No text compression detected — page may load slowly without gzip or Brotli',
        details
      );
    }

    // Check if any supported encoding is present (content-encoding can have multiple values)
    const encodingParts = encoding.split(',').map((e) => e.trim());
    const matchedEncoding = encodingParts.find((e) =>
      SUPPORTED_ENCODINGS.some((supported) => e === supported)
    );

    if (matchedEncoding) {
      return pass(
        'perf-text-compression',
        `Text compression enabled (${matchedEncoding})`,
        { ...details, detectedEncoding: matchedEncoding }
      );
    }

    return warn(
      'perf-text-compression',
      `Unrecognized content-encoding "${encoding}" — expected gzip, br, deflate, or zstd`,
      details
    );
  },
});
