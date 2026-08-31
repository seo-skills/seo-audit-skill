import { gunzipSync } from 'node:zlib';
import { getUserAgent } from './user-agent.js';
import type { SitemapEntry, SitemapFetchResult } from '../types.js';

/**
 * Sitemap discovery and parsing.
 *
 * Handles the three shapes real sites ship that a single `<loc>` regex does
 * not: sitemap *index* files that point at other sitemaps, gzipped sitemaps,
 * and robots.txt files that declare several sitemaps.
 */

/** How many child sitemaps to follow from an index. */
const MAX_CHILD_SITEMAPS = 10;

/** Hard ceiling on collected URLs, so a huge site cannot exhaust memory. */
const MAX_URLS = 50_000;

const FETCH_TIMEOUT_MS = 10_000;

/** gzip streams start with 0x1f 0x8b regardless of how they are served. */
function isGzip(bytes: Uint8Array): boolean {
  return bytes.length > 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
}

/**
 * Fetch a sitemap URL, transparently decompressing a gzipped body.
 *
 * `fetch` already handles `Content-Encoding: gzip`, but a `sitemap.xml.gz`
 * served as `application/gzip` is a gzip *payload*, not a gzip encoding, and
 * arrives compressed.
 */
async function fetchSitemapDocument(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': getUserAgent() },
    });
    if (!response.ok) return null;

    const bytes = new Uint8Array(await response.arrayBuffer());
    if (isGzip(bytes)) {
      try {
        return gunzipSync(bytes).toString('utf8');
      } catch {
        return null;
      }
    }
    return new TextDecoder('utf-8').decode(bytes);
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

/** Read the text of the first matching child tag within an XML fragment */
function tagText(fragment: string, tag: string): string | undefined {
  const match = fragment.match(new RegExp(`<${tag}[^>]*>\\s*([\\s\\S]*?)\\s*</${tag}>`, 'i'));
  return match ? decodeXml(match[1].trim()) : undefined;
}

/** Resolve the five predefined XML entities plus numeric references */
function decodeXml(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&amp;/g, '&');
}

/**
 * Determine whether a sitemap document is an index of other sitemaps.
 *
 * Checked on the root element rather than by searching for `<sitemap>`
 * anywhere, because a URL in a urlset can legitimately contain that substring.
 */
export function isSitemapIndex(xml: string): boolean {
  return /<sitemapindex[\s>]/i.test(xml);
}

/**
 * Parse the `<url>` entries of a urlset document.
 *
 * @param xml - Sitemap XML
 * @returns One entry per `<url>`, with whatever metadata each carries
 */
export function parseSitemapEntries(xml: string): SitemapEntry[] {
  const entries: SitemapEntry[] = [];
  const urlBlocks = xml.match(/<url[\s>][\s\S]*?<\/url>/gi) ?? [];

  for (const block of urlBlocks) {
    const loc = tagText(block, 'loc');
    if (!loc) continue;

    const entry: SitemapEntry = { loc };
    const lastmod = tagText(block, 'lastmod');
    if (lastmod) entry.lastmod = lastmod;
    const changefreq = tagText(block, 'changefreq');
    if (changefreq) entry.changefreq = changefreq;
    const priority = tagText(block, 'priority');
    if (priority !== undefined) {
      const parsed = Number.parseFloat(priority);
      if (!Number.isNaN(parsed)) entry.priority = parsed;
    }
    entries.push(entry);
  }

  // A urlset with no <url> wrappers is malformed but common enough that
  // falling back to bare <loc> extraction gives the rules something to judge.
  if (entries.length === 0) {
    const locRegex = /<loc[^>]*>\s*([\s\S]*?)\s*<\/loc>/gi;
    let match: RegExpExecArray | null;
    while ((match = locRegex.exec(xml)) !== null) {
      entries.push({ loc: decodeXml(match[1].trim()) });
    }
  }

  return entries;
}

/**
 * Extract the child sitemap URLs listed in a sitemap index.
 */
export function parseSitemapIndex(xml: string): string[] {
  const children: string[] = [];
  const blocks = xml.match(/<sitemap[\s>][\s\S]*?<\/sitemap>/gi) ?? [];
  for (const block of blocks) {
    const loc = tagText(block, 'loc');
    if (loc) children.push(loc);
  }
  return children;
}

/**
 * Every sitemap URL declared in robots.txt.
 *
 * The previous implementation used a non-global match and kept only the first,
 * silently truncating sites that split their sitemaps by section.
 */
export function parseSitemapDeclarations(robotsTxtContent: string): string[] {
  const declarations: string[] = [];
  const regex = /^\s*Sitemap:\s*(\S+)\s*$/gim;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(robotsTxtContent)) !== null) {
    declarations.push(match[1].trim());
  }
  return declarations;
}

/**
 * Discover and fetch a site's sitemap, following one level of index nesting.
 *
 * @param siteUrl - Any URL on the site, used to derive the default location
 * @param robotsTxtContent - robots.txt body, when already fetched
 * @returns Collected URLs and entries, plus what was fetched and skipped
 */
export async function fetchSitemap(
  siteUrl: string,
  robotsTxtContent?: string
): Promise<SitemapFetchResult> {
  const empty: SitemapFetchResult = {
    urls: [],
    entries: [],
    sources: [],
    isIndex: false,
    skippedSitemaps: 0,
  };

  let origin: string;
  try {
    const parsed = new URL(siteUrl);
    origin = `${parsed.protocol}//${parsed.host}`;
  } catch {
    return empty;
  }

  const declared = robotsTxtContent ? parseSitemapDeclarations(robotsTxtContent) : [];
  const startingPoints = declared.length > 0 ? declared : [`${origin}/sitemap.xml`];

  const entries: SitemapEntry[] = [];
  const sources: string[] = [];
  const seen = new Set<string>();
  let rootContent: string | undefined;
  let sawIndex = false;
  let skippedSitemaps = 0;
  let childBudget = MAX_CHILD_SITEMAPS;

  for (const start of startingPoints) {
    if (seen.has(start)) continue;
    seen.add(start);

    const xml = await fetchSitemapDocument(start);
    if (xml === null) continue;

    sources.push(start);
    if (rootContent === undefined) rootContent = xml;

    if (isSitemapIndex(xml)) {
      sawIndex = true;
      const children = parseSitemapIndex(xml);
      for (const child of children) {
        if (childBudget <= 0 || entries.length >= MAX_URLS) {
          skippedSitemaps++;
          continue;
        }
        if (seen.has(child)) continue;
        seen.add(child);
        childBudget--;

        const childXml = await fetchSitemapDocument(child);
        if (childXml === null) continue;
        sources.push(child);
        entries.push(...parseSitemapEntries(childXml));
      }
    } else {
      entries.push(...parseSitemapEntries(xml));
    }

    if (entries.length >= MAX_URLS) break;
  }

  const capped = entries.slice(0, MAX_URLS);

  return {
    ...(rootContent !== undefined && { content: rootContent }),
    urls: capped.map((entry) => entry.loc),
    entries: capped,
    sources,
    isIndex: sawIndex,
    skippedSitemaps,
  };
}
