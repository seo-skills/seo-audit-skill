import * as zlib from 'zlib';

/**
 * Compression threshold in bytes (10KB)
 * Only compress HTML larger than this to avoid overhead on small pages
 */
export const COMPRESSION_THRESHOLD = 10 * 1024;

/**
 * Compression level (1-9, where 6 is default balance of speed/size)
 */
export const COMPRESSION_LEVEL = 6;

/**
 * Result of HTML compression
 */
export interface CompressionResult {
  /** Compressed or original data as Buffer */
  data: Buffer;
  /** Whether the data was compressed */
  compressed: boolean;
  /** Original size in bytes */
  originalSize: number;
  /** Final size in bytes */
  finalSize: number;
}

/**
 * Compress HTML content if it exceeds the threshold
 *
 * Uses zlib deflate with level 6 (good balance of speed/compression).
 * Only compresses if the result is smaller than the original.
 *
 * @param html - HTML string to compress
 * @returns Compression result with data and metadata
 */
export function compressHtml(html: string): CompressionResult {
  const originalBuffer = Buffer.from(html, 'utf-8');
  const originalSize = originalBuffer.length;

  // Don't compress small content
  if (originalSize < COMPRESSION_THRESHOLD) {
    return {
      data: originalBuffer,
      compressed: false,
      originalSize,
      finalSize: originalSize,
    };
  }

  // Compress with zlib deflate
  const compressed = zlib.deflateSync(originalBuffer, {
    level: COMPRESSION_LEVEL,
  });

  // Only use compressed version if it's actually smaller
  if (compressed.length >= originalBuffer.length) {
    return {
      data: originalBuffer,
      compressed: false,
      originalSize,
      finalSize: originalSize,
    };
  }

  return {
    data: compressed,
    compressed: true,
    originalSize,
    finalSize: compressed.length,
  };
}

/**
 * Decompress HTML content
 *
 * @param data - Buffer containing HTML (compressed or not)
 * @param isCompressed - Whether the data is compressed
 * @returns Decompressed HTML string
 */
export function decompressHtml(data: Buffer, isCompressed: boolean): string {
  if (!isCompressed) {
    return data.toString('utf-8');
  }

  const decompressed = zlib.inflateSync(data);
  return decompressed.toString('utf-8');
}

/**
 * Calculate compression ratio
 *
 * @param originalSize - Original size in bytes
 * @param compressedSize - Compressed size in bytes
 * @returns Compression ratio as percentage (e.g., 75 means 75% reduction)
 */
export function compressionRatio(
  originalSize: number,
  compressedSize: number
): number {
  if (originalSize === 0) return 0;
  return Math.round((1 - compressedSize / originalSize) * 100);
}
