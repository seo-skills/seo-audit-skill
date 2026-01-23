import * as cheerio from 'cheerio';
import type { CheerioAPI } from 'cheerio';
import type { AuditContext, LinkInfo, ImageInfo, CoreWebVitals } from '../types.js';

/**
 * Result of fetching a page
 */
export interface FetchResult {
  /** Raw HTML content */
  html: string;
  /** Cheerio instance for DOM querying */
  $: CheerioAPI;
  /** HTTP response headers */
  headers: Record<string, string>;
  /** HTTP status code */
  statusCode: number;
  /** Response time in milliseconds */
  responseTime: number;
}

/**
 * Fetch a page with HTTP GET and parse with Cheerio
 * @param url - URL to fetch
 * @param timeout - Request timeout in milliseconds (default: 30000)
 * @returns FetchResult with html, $, headers, statusCode, responseTime
 */
export async function fetchPage(url: string, timeout = 30000): Promise<FetchResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  const startTime = performance.now();

  try {
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'User-Agent': 'SEOmatorBot/1.0 (+https://github.com/seo-skills/seo-audit-skill)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      redirect: 'follow',
    });

    const responseTime = performance.now() - startTime;
    const html = await response.text();
    const $ = cheerio.load(html);

    // Convert headers to plain object
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });

    return {
      html,
      $,
      headers,
      statusCode: response.status,
      responseTime: Math.round(responseTime),
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Fetch URL with HEAD request for link checking
 * @param url - URL to check
 * @param timeout - Request timeout in milliseconds (default: 10000)
 * @returns HTTP status code
 */
export async function fetchUrl(url: string, timeout = 10000): Promise<number> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      headers: {
        'User-Agent': 'SEOmatorBot/1.0 (+https://github.com/seo-skills/seo-audit-skill)',
      },
      redirect: 'follow',
    });

    return response.status;
  } catch (error) {
    // Return 0 for network errors, timeouts, etc.
    if (error instanceof Error && error.name === 'AbortError') {
      return 0; // Timeout
    }
    return 0; // Network error
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Extract links from parsed HTML
 * @param $ - Cheerio instance
 * @param baseUrl - Base URL for resolving relative links
 * @returns Array of LinkInfo objects
 */
function extractLinks($: CheerioAPI, baseUrl: string): LinkInfo[] {
  const links: LinkInfo[] = [];
  const baseUrlObj = new URL(baseUrl);

  $('a[href]').each((_, element) => {
    const $el = $(element);
    const href = $el.attr('href');

    if (!href) return;

    // Skip javascript:, mailto:, tel:, and data: URLs
    if (/^(javascript:|mailto:|tel:|data:|#)/i.test(href)) {
      return;
    }

    try {
      // Resolve relative URLs
      const resolvedUrl = new URL(href, baseUrl);
      const normalizedHref = resolvedUrl.href;

      // Determine if internal
      const isInternal = resolvedUrl.hostname === baseUrlObj.hostname;

      // Check for nofollow
      const rel = $el.attr('rel') || '';
      const isNoFollow = rel.toLowerCase().includes('nofollow');

      // Get link text
      const text = $el.text().trim() || $el.attr('title') || '';

      links.push({
        href: normalizedHref,
        text: text.slice(0, 200), // Truncate long text
        isInternal,
        isNoFollow,
      });
    } catch {
      // Invalid URL, skip
    }
  });

  return links;
}

/**
 * Extract images from parsed HTML
 * @param $ - Cheerio instance
 * @param baseUrl - Base URL for resolving relative image sources
 * @returns Array of ImageInfo objects
 */
function extractImages($: CheerioAPI, baseUrl: string): ImageInfo[] {
  const images: ImageInfo[] = [];

  $('img').each((_, element) => {
    const $el = $(element);
    const src = $el.attr('src') || $el.attr('data-src') || '';

    // Skip data URLs and empty sources
    if (!src || src.startsWith('data:')) {
      return;
    }

    let resolvedSrc = src;
    try {
      resolvedSrc = new URL(src, baseUrl).href;
    } catch {
      // Keep original if resolution fails
    }

    const alt = $el.attr('alt');
    const loading = $el.attr('loading');

    images.push({
      src: resolvedSrc,
      alt: alt ?? '',
      hasAlt: alt !== undefined,
      width: $el.attr('width'),
      height: $el.attr('height'),
      isLazyLoaded: loading === 'lazy' || $el.attr('data-src') !== undefined,
    });
  });

  return images;
}

/**
 * Build full AuditContext from fetch result
 * @param url - The URL that was fetched
 * @param fetchResult - Result from fetchPage
 * @param cwv - Optional Core Web Vitals metrics
 * @returns Complete AuditContext object
 */
export function createAuditContext(
  url: string,
  fetchResult: FetchResult,
  cwv: CoreWebVitals = {}
): AuditContext {
  const { html, $, headers, statusCode, responseTime } = fetchResult;

  return {
    url,
    html,
    $,
    headers,
    statusCode,
    responseTime,
    cwv,
    links: extractLinks($, url),
    images: extractImages($, url),
  };
}
