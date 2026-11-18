/**
 * A reader for raw HTML source that keeps every offset.
 *
 * Checks for mistakes the parser repairs (a second <body>, a <div> in <head>)
 * must read the source, and must not be fooled by markup that only looks like
 * a tag: inside a comment, an attribute value, or the text of a raw-text
 * element such as <script> or <textarea>. This masks all of those with spaces
 * of the same length, so a match in the masked source sits at the same offset
 * in the original.
 */

/** Elements whose content is text, not markup, up to their end tag */
const RAW_TEXT = new Set(['script', 'style', 'textarea', 'title', 'template']);

export interface SourceTag {
  /** Lowercased element name */
  name: string;
  /** Offset of the `<` */
  start: number;
  /** Offset just past the `>` */
  end: number;
  closing: boolean;
}

export interface ScannedSource {
  /** The source with comments, attribute values and raw-text content blanked */
  masked: string;
  /** Start and end tags, in source order */
  tags: SourceTag[];
}

const blank = (chars: string[], from: number, to: number) => {
  for (let i = from; i < to; i++) if (chars[i] !== '\n') chars[i] = ' ';
};

export function scanSource(html: string): ScannedSource {
  const chars = html.split('');
  const tags: SourceTag[] = [];
  const lower = html.toLowerCase();
  let i = 0;
  while (i < html.length) {
    if (html[i] !== '<') {
      i++;
      continue;
    }
    if (html.startsWith('<!--', i)) {
      const close = html.indexOf('-->', i + 4);
      const end = close === -1 ? html.length : close + 3;
      blank(chars, i, end);
      i = end;
      continue;
    }
    if (html[i + 1] === '!' || html[i + 1] === '?') {
      // A doctype or processing instruction: not an element
      const close = html.indexOf('>', i);
      i = close === -1 ? html.length : close + 1;
      continue;
    }
    const closing = html[i + 1] === '/';
    const nameMatch = /^[a-zA-Z][\w:-]*/.exec(html.slice(i + (closing ? 2 : 1), i + 80));
    if (!nameMatch) {
      i++;
      continue;
    }
    const name = nameMatch[0].toLowerCase();
    // Walk the attributes, blanking quoted values so a ">" or "<body" in one
    // neither ends the tag nor reads as a tag
    let j = i + (closing ? 2 : 1) + nameMatch[0].length;
    while (j < html.length && html[j] !== '>') {
      if (html[j] === '"' || html[j] === "'") {
        const close = html.indexOf(html[j], j + 1);
        const end = close === -1 ? html.length : close;
        blank(chars, j + 1, end);
        j = end + 1;
        continue;
      }
      j++;
    }
    const end = Math.min(j + 1, html.length);
    tags.push({ name, start: i, end, closing });
    i = end;
    if (!closing && RAW_TEXT.has(name)) {
      const close = lower.indexOf(`</${name}`, i);
      const stop = close === -1 ? html.length : close;
      blank(chars, i, stop);
      i = stop;
    }
  }
  return { masked: chars.join(''), tags };
}
