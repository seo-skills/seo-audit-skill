import { gunzipSync } from 'node:zlib';
import { getUserAgent } from './user-agent.js';
import { rethrowIfAborted, throwIfAborted } from '../errors.js';
import type { SitemapDocument, SitemapEntry, SitemapFetchResult, SitemapGap } from '../types.js';
import { netFetch, readBodyCapped } from '../net/fetch.js';

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

/** The sitemap protocol's own size limit for one file, uncompressed */
const MAX_SITEMAP_BYTES = 50 * 1024 * 1024;

/**
 * Fetch a sitemap URL, transparently decompressing a gzipped body.
 *
 * `fetch` already handles `Content-Encoding: gzip`, but a `sitemap.xml.gz`
 * served as `application/gzip` is a gzip *payload*, not a gzip encoding, and
 * arrives compressed.
 */
async function fetchSitemapDocument(url: string, signal?: AbortSignal): Promise<{ xml: string } | { status?: number }> {
  throwIfAborted(signal);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await netFetch(url, {
      signal: signal ? AbortSignal.any([signal, controller.signal]) : controller.signal,
      headers: { 'User-Agent': getUserAgent() },
    });
    if (!response.ok) {
      await response.body?.cancel().catch(() => {});
      return { status: response.status };
    }

    // Capped while reading and while decompressing: the sitemap protocol
    // allows 50 MB uncompressed, and a small gzip can expand far past that.
    const bytes = await readBodyCapped(response, MAX_SITEMAP_BYTES);
    if (isGzip(bytes)) {
      try {
        return { xml: gunzipSync(bytes, { maxOutputLength: MAX_SITEMAP_BYTES }).toString('utf8') };
      } catch {
        return {};
      }
    }
    return { xml: new TextDecoder('utf-8').decode(bytes) };
  } catch (error) {
    rethrowIfAborted(error, signal);
    return {};
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
  robotsTxtContent?: string,
  signal?: AbortSignal
): Promise<SitemapFetchResult> {
  const empty: SitemapFetchResult = {
    urls: [],
    entries: [],
    sources: [],
    isIndex: false,
    skippedSitemaps: 0,
    documents: [],
    complete: false,
    gaps: [],
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
  const documents: SitemapDocument[] = [];
  /** Which sitemap document each URL came from; several means duplicate listing */
  const sourceByLoc = new Map<string, string[]>();
  const seen = new Set<string>();
  let rootContent: string | undefined;
  let sawIndex = false;
  let skippedSitemaps = 0;
  let childBudget = MAX_CHILD_SITEMAPS;
  const gaps: SitemapGap[] = [];
  let truncated = false;

  /** The document's XML, or null with the reason recorded */
  const read = async (url: string): Promise<string | null> => {
    const fetched = await fetchSitemapDocument(url, signal);
    if (!('xml' in fetched)) {
      gaps.push({ kind: 'fetch-failed', url, ...(fetched.status !== undefined && { status: fetched.status }) });
      return null;
    }
    return fetched.xml;
  };

  const collectEntries = (documentUrl: string, xml: string): void => {
    // An HTML page or an error body at the sitemap's URL lists nothing, and
    // says nothing about what the real sitemap would have listed
    if (!/<urlset[\s>]/i.test(xml)) {
      gaps.push({ kind: 'invalid', url: documentUrl });
      return;
    }
    const parsed = parseSitemapEntries(xml);
    documents.push({
      url: documentUrl,
      urlCount: parsed.length,
      bytes: Buffer.byteLength(xml, 'utf8'),
      isIndex: false,
    });
    for (const entry of parsed) {
      entries.push(entry);
      const known = sourceByLoc.get(entry.loc);
      if (known) {
        // A repeat inside one document is a duplicate in that file, not a
        // second document declaring the URL.
        if (!known.includes(documentUrl)) known.push(documentUrl);
      } else {
        sourceByLoc.set(entry.loc, [documentUrl]);
      }
    }
  };

  for (const [index, start] of startingPoints.entries()) {
    if (seen.has(start)) continue;
    // Roots the URL cap stopped us reaching
    if (entries.length >= MAX_URLS) {
      for (const unread of startingPoints.slice(index)) if (!seen.has(unread)) gaps.push({ kind: 'unread', url: unread });
      break;
    }
    seen.add(start);

    const xml = await read(start);
    if (xml === null) continue;

    sources.push(start);
    if (rootContent === undefined) rootContent = xml;

    if (isSitemapIndex(xml)) {
      sawIndex = true;
      documents.push({ url: start, urlCount: 0, bytes: Buffer.byteLength(xml, 'utf8'), isIndex: true });
      const children = parseSitemapIndex(xml);
      for (const child of children) {
        if (seen.has(child)) continue;
        if (childBudget <= 0 || entries.length >= MAX_URLS) {
          skippedSitemaps++;
          gaps.push({ kind: 'unread', url: child });
          continue;
        }
        seen.add(child);
        childBudget--;

        const childXml = await read(child);
        if (childXml === null) continue;
        sources.push(child);
        collectEntries(child, childXml);
      }
    } else {
      collectEntries(start, xml);
    }

  }

  // Counted across every document, a single oversized urlset included
  if (entries.length > MAX_URLS) {
    truncated = true;
    gaps.push({ kind: 'truncated', limit: MAX_URLS });
  }
  const capped = entries.slice(0, MAX_URLS);
  const urlSources = new Map<string, string[]>();
  for (const entry of capped) {
    urlSources.set(entry.loc, sourceByLoc.get(entry.loc) ?? []);
  }

  return {
    ...(rootContent !== undefined && { content: rootContent }),
    urls: capped.map((entry) => entry.loc),
    entries: capped,
    sources,
    isIndex: sawIndex,
    skippedSitemaps,
    documents,
    // Omitted when nothing was fetched, so "unknown" stays distinguishable
    // from "fetched, and no URL is listed twice".
    ...(sources.length > 0 && { urlSources }),
    // Nothing read at all is not a complete inventory either
    complete: gaps.length === 0 && sources.length > 0 && !truncated,
    gaps,
  };
}

/** Why a sitemap inventory is partial, in one line a finding can show */
export function describeSitemapGaps(gaps: SitemapGap[]): string {
  const count = (kind: SitemapGap['kind']) => gaps.filter((gap) => gap.kind === kind).length;
  const sitemaps = (n: number) => `${n} sitemap${n === 1 ? '' : 's'}`;
  const parts = [
    count('fetch-failed') > 0 ? `${sitemaps(count('fetch-failed'))} could not be fetched` : '',
    count('invalid') > 0 ? `${sitemaps(count('invalid'))} could not be parsed` : '',
    count('unread') > 0 ? `${sitemaps(count('unread'))} were not read (limit reached)` : '',
    count('truncated') > 0 ? 'URLs past 50,000 were dropped' : '',
  ];
  return parts.filter(Boolean).join(', ');
}
