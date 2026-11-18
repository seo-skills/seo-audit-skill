/** Image headers of a chosen size, for tests: just enough bytes to read */

const text = (s: string) => [...s].map((c) => c.charCodeAt(0));
const be32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const le16 = (n: number) => [n & 255, (n >> 8) & 255];
const le24 = (n: number) => [n & 255, (n >> 8) & 255, (n >> 16) & 255];

export function png(width: number, height: number): Uint8Array<ArrayBuffer> {
  return new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, ...text('IHDR'), ...be32(width), ...be32(height), 8, 6, 0, 0, 0]);
}

export function jpeg(width: number, height: number): Uint8Array<ArrayBuffer> {
  const app0 = [0xff, 0xe0, 0x00, 0x10, ...text('JFIF'), 0, 1, 1, 0, 0, 1, 0, 1, 0, 0];
  const sof = [0xff, 0xc0, 0x00, 0x11, 0x08, (height >> 8) & 255, height & 255, (width >> 8) & 255, width & 255, 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1];
  return new Uint8Array([0xff, 0xd8, ...app0, ...sof, 0xff, 0xd9]);
}

export function gif(width: number, height: number): Uint8Array<ArrayBuffer> {
  return new Uint8Array([...text('GIF89a'), ...le16(width), ...le16(height), 0, 0, 0]);
}

export function webp(kind: 'VP8 ' | 'VP8L' | 'VP8X', width: number, height: number): Uint8Array<ArrayBuffer> {
  const head = [...text('RIFF'), 0, 0, 0, 0, ...text('WEBP'), ...text(kind), 0, 0, 0, 0];
  if (kind === 'VP8X') return new Uint8Array([...head, 0, 0, 0, 0, ...le24(width - 1), ...le24(height - 1)]);
  if (kind === 'VP8L') {
    const bits = ((width - 1) | ((height - 1) << 14)) >>> 0;
    return new Uint8Array([...head, 0x2f, bits & 255, (bits >>> 8) & 255, (bits >>> 16) & 255, (bits >>> 24) & 255, 0, 0, 0, 0, 0]);
  }
  return new Uint8Array([...head, 0, 0, 0, 0x9d, 0x01, 0x2a, ...le16(width), ...le16(height)]);
}

export function avif(): Uint8Array<ArrayBuffer> {
  return new Uint8Array([0, 0, 0, 0x1c, ...text('ftyp'), ...text('avif'), 0, 0, 0, 0]);
}
