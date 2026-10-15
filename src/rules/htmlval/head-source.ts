/**
 * Readers for the document source of <head>.
 *
 * Cheerio parses with parse5, which repairs the tree the way a browser does: a
 * <div> written in <head> closes the head and lands in <body>, a second <head>
 * is dropped, and <noscript> content becomes text. Checks for those mistakes
 * have to read the source, because the parsed tree no longer contains them.
 */

/** Source with comments removed and script, style and template bodies emptied */
function stripInert(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|template)\b([^>]*)>[\s\S]*?<\/\1\s*>/gi, '<$1$2></$1>');
}

const HEAD_START = /<head(?=[\s/>])[^>]*>/gi;

/** Number of <head> start tags in the source */
export function countHeadStartTags(html: string): number {
  return stripInert(html).match(HEAD_START)?.length ?? 0;
}

/**
 * The source between the first <head> start tag and the first </head> (or
 * <body>, when </head> is omitted). Comments are removed and script, style
 * and template bodies emptied, so markup quoted inside them never counts.
 *
 * @returns The head source, or null when the document has no <head> tag
 */
export function headSource(html: string): string | null {
  const source = stripInert(html);
  HEAD_START.lastIndex = 0;
  const start = HEAD_START.exec(source);
  if (!start) return null;
  const from = start.index + start[0].length;
  const rest = source.slice(from);
  const end = rest.search(/<\/head\s*>|<body(?=[\s/>])/i);
  return end === -1 ? rest : rest.slice(0, end);
}

/** Lowercased names of the start tags in a fragment of source, in order */
export function startTags(source: string): string[] {
  return [...source.matchAll(/<([a-zA-Z][\w-]*)/g)].map((match) => match[1].toLowerCase());
}

/** The inner source of each <noscript> in a fragment */
export function noscriptBodies(source: string): string[] {
  return [...source.matchAll(/<noscript\b[^>]*>([\s\S]*?)<\/noscript\s*>/gi)].map((match) => match[1]);
}

/** A fragment with its <noscript> blocks removed */
export function withoutNoscript(source: string): string {
  return source.replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript\s*>/gi, '');
}
