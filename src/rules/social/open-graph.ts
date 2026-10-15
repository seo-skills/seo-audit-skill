import type { CheerioAPI } from 'cheerio';

/**
 * Which attribute declared an Open Graph tag.
 *
 * The protocol (ogp.me) is built on RDFa and specifies `property=`. Writing
 * `<meta name="og:title">` instead is a common deviation, made by sites as
 * large as developer.mozilla.org, and the major unfurlers still read it. So a
 * `name=` tag is found and reported as a deviation, never treated as absent.
 */
export type OgAttribute = 'property' | 'name';

export interface OgTag {
  /** Trimmed content of the first matching element; undefined when empty */
  content: string | undefined;
  attribute: OgAttribute;
}

/**
 * Finds an Open Graph tag, preferring `property=` over `name=`.
 *
 * @returns The tag, or null when neither attribute declares it
 */
export function findOgTag($: CheerioAPI, key: string): OgTag | null {
  for (const attribute of ['property', 'name'] as const) {
    const element = $(`meta[${attribute}="${key}"]`).first();
    if (element.length > 0) {
      return { content: element.attr('content')?.trim() || undefined, attribute };
    }
  }
  return null;
}

/** Message for a tag that is present but declared with `name=` */
export function nameAttributeMessage(label: string, key: string): string {
  return `${label} is present but declared as <meta name="${key}">; the Open Graph protocol specifies <meta property="${key}">`;
}
