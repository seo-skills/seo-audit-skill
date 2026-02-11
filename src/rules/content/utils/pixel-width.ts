/**
 * Approximate pixel width of text at standard SERP font size (~16px Arial)
 * Based on average character width measurements
 */
export function estimatePixelWidth(text: string): number {
  let width = 0;
  for (const char of text) {
    if (char === ' ') {
      width += 4;
    } else if (char >= 'A' && char <= 'Z') {
      width += 9.5;
    } else if (char >= 'a' && char <= 'z') {
      width += 7.5;
    } else if (char >= '0' && char <= '9') {
      width += 7.5;
    } else if (
      char === '.' ||
      char === ',' ||
      char === ':' ||
      char === ';' ||
      char === '!' ||
      char === '|' ||
      char === 'i' ||
      char === 'l' ||
      char === '1'
    ) {
      width += 4;
    } else if (
      char === 'm' ||
      char === 'w' ||
      char === 'M' ||
      char === 'W'
    ) {
      width += 11;
    } else {
      width += 7.5;
    }
  }
  return Math.round(width);
}
