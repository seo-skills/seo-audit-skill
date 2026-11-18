/**
 * An image's format and pixel size from its first bytes, without decoding it
 * and without a dependency. Dimensions are absent when the header does not
 * hold them within the bytes given (a JPEG whose frame header comes late) or
 * the format is not read here (AVIF, SVG).
 */
export interface ImageHeader {
  format: 'png' | 'jpeg' | 'gif' | 'webp' | 'avif' | 'svg' | 'unknown';
  width?: number;
  height?: number;
}

const be16 = (b: Uint8Array, i: number) => (b[i] << 8) | b[i + 1];
const le16 = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8);
const be32 = (b: Uint8Array, i: number) => ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;
const ascii = (b: Uint8Array, start: number, end: number) => String.fromCharCode(...b.subarray(start, end));

/** JPEG start-of-frame markers: the ones that carry the frame's size */
const SOF = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);

function sized(format: ImageHeader['format'], width: number, height: number): ImageHeader {
  return width > 0 && height > 0 ? { format, width, height } : { format };
}

function jpeg(b: Uint8Array): ImageHeader {
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) return { format: 'jpeg' };
    const marker = b[i + 1];
    if (marker === 0xff) {
      i++; // fill byte
      continue;
    }
    if (SOF.has(marker)) return sized('jpeg', be16(b, i + 7), be16(b, i + 5));
    // Markers without a length: restart markers, start and end of image
    if ((marker >= 0xd0 && marker <= 0xd9) || marker === 0x01) {
      i += 2;
      continue;
    }
    i += 2 + be16(b, i + 2);
  }
  return { format: 'jpeg' };
}

function webp(b: Uint8Array): ImageHeader {
  if (b.length < 30) return { format: 'webp' };
  const chunk = ascii(b, 12, 16);
  if (chunk === 'VP8 ') return sized('webp', le16(b, 26) & 0x3fff, le16(b, 28) & 0x3fff);
  if (chunk === 'VP8L') {
    const width = 1 + (((b[22] & 0x3f) << 8) | b[21]);
    const height = 1 + (((b[24] & 0x0f) << 10) | (b[23] << 2) | ((b[22] & 0xc0) >> 6));
    return sized('webp', width, height);
  }
  if (chunk === 'VP8X') {
    const width = 1 + (b[24] | (b[25] << 8) | (b[26] << 16));
    const height = 1 + (b[27] | (b[28] << 8) | (b[29] << 16));
    return sized('webp', width, height);
  }
  return { format: 'webp' };
}

export function readImageHeader(bytes: Uint8Array | undefined): ImageHeader {
  const b = bytes ?? new Uint8Array(0);
  if (b.length >= 24 && be32(b, 0) === 0x89504e47 && be32(b, 4) === 0x0d0a1a0a && ascii(b, 12, 16) === 'IHDR') {
    return sized('png', be32(b, 16), be32(b, 20));
  }
  if (b.length >= 10 && (ascii(b, 0, 6) === 'GIF87a' || ascii(b, 0, 6) === 'GIF89a')) {
    return sized('gif', le16(b, 6), le16(b, 8));
  }
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return jpeg(b);
  if (b.length >= 16 && ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 12) === 'WEBP') return webp(b);
  if (b.length >= 12 && ascii(b, 4, 8) === 'ftyp' && /^avi[fs]$/.test(ascii(b, 8, 12))) return { format: 'avif' };
  const text = new TextDecoder('utf-8').decode(b.subarray(0, 512)).trimStart();
  if (/^(?:<\?xml[^>]*>\s*)?(?:<!--[\s\S]*?-->\s*)*<svg[\s>]/i.test(text)) return { format: 'svg' };
  return { format: 'unknown' };
}
