import * as cheerio from 'cheerio';
import type { CheerioAPI } from 'cheerio';
import type { AuditContext, LinkInfo, ImageInfo, CoreWebVitals, InvalidLinkInfo, SpecialLinkInfo } from '../types.js';

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
 * Result of link extraction including invalid links
 */
interface LinkExtractionResult {
  links: LinkInfo[];
  invalidLinks: InvalidLinkInfo[];
}

/**
 * Extract links from parsed HTML
 * @param $ - Cheerio instance
 * @param baseUrl - Base URL for resolving relative links
 * @returns Object with valid links and invalid links
 */
function extractLinks($: CheerioAPI, baseUrl: string): LinkExtractionResult {
  const links: LinkInfo[] = [];
  const invalidLinks: InvalidLinkInfo[] = [];
  const baseUrlObj = new URL(baseUrl);

  $('a[href]').each((_, element) => {
    const $el = $(element);
    const href = $el.attr('href');
    const text = ($el.text().trim() || $el.attr('title') || '').slice(0, 200);

    // Check for empty or hash-only href
    if (!href || href === '' || href === '#') {
      invalidLinks.push({
        href: href || '',
        reason: 'empty',
        text,
      });
      return;
    }

    // Check for javascript: URLs
    if (/^javascript:/i.test(href)) {
      invalidLinks.push({
        href,
        reason: 'javascript',
        text,
      });
      return;
    }

    // Skip mailto:, tel:, and data: URLs (handled separately)
    if (/^(mailto:|tel:|data:)/i.test(href)) {
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

      links.push({
        href: normalizedHref,
        text,
        isInternal,
        isNoFollow,
      });
    } catch {
      // Malformed URL
      invalidLinks.push({
        href,
        reason: 'malformed',
        text,
      });
    }
  });

  return { links, invalidLinks };
}

/**
 * Validate email format (basic validation)
 */
function isValidEmail(email: string): { isValid: boolean; issue?: string } {
  if (!email) {
    return { isValid: false, issue: 'Empty email address' };
  }
  // Basic email regex - checks for format: something@something.something
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { isValid: false, issue: 'Invalid email format' };
  }
  return { isValid: true };
}

/**
 * Validate phone number format (E.164-ish: digits, spaces, dashes, parens, plus)
 */
function isValidPhone(phone: string): { isValid: boolean; issue?: string } {
  if (!phone) {
    return { isValid: false, issue: 'Empty phone number' };
  }
  // Remove allowed characters and check if remaining are digits
  const cleaned = phone.replace(/[\s\-\(\)\+\.]/g, '');
  if (!/^\d{7,15}$/.test(cleaned)) {
    return { isValid: false, issue: 'Invalid phone format (should be 7-15 digits)' };
  }
  return { isValid: true };
}

/**
 * Extract special protocol links (tel:, mailto:) from parsed HTML
 * @param $ - Cheerio instance
 * @returns Array of SpecialLinkInfo objects
 */
function extractSpecialLinks($: CheerioAPI): SpecialLinkInfo[] {
  const specialLinks: SpecialLinkInfo[] = [];

  $('a[href]').each((_, element) => {
    const $el = $(element);
    const href = $el.attr('href');
    if (!href) return;

    const text = ($el.text().trim() || $el.attr('title') || '').slice(0, 200);

    // Check for tel: links
    if (/^tel:/i.test(href)) {
      const value = href.replace(/^tel:/i, '');
      const validation = isValidPhone(value);
      specialLinks.push({
        type: 'tel',
        href,
        value,
        text,
        isValid: validation.isValid,
        ...(validation.issue && { issue: validation.issue }),
      });
      return;
    }

    // Check for mailto: links
    if (/^mailto:/i.test(href)) {
      // Extract email (before any ? for subject/body params)
      const value = href.replace(/^mailto:/i, '').split('?')[0];
      const validation = isValidEmail(value);
      specialLinks.push({
        type: 'mailto',
        href,
        value,
        text,
        isValid: validation.isValid,
        ...(validation.issue && { issue: validation.issue }),
      });
    }
  });

  return specialLinks;
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
 * Result of fetching a URL with redirect tracking
 */
export interface RedirectResult {
  /** Final URL after all redirects */
  finalUrl: string;
  /** HTTP status code of final response */
  statusCode: number;
  /** Number of redirects followed */
  redirectCount: number;
  /** Chain of URLs followed */
  chain: string[];
}

/**
 * Fetch URL with redirect tracking (no auto-follow)
 * @param url - URL to check
 * @param timeout - Request timeout in milliseconds (default: 10000)
 * @param maxRedirects - Maximum redirects to follow (default: 5)
 * @returns RedirectResult with final URL and redirect chain
 */
export async function fetchUrlWithRedirects(
  url: string,
  timeout = 10000,
  maxRedirects = 5
): Promise<RedirectResult> {
  const chain: string[] = [url];
  let currentUrl = url;
  let redirectCount = 0;

  while (redirectCount < maxRedirects) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(currentUrl, {
        method: 'HEAD',
        signal: controller.signal,
        headers: {
          'User-Agent': 'SEOmatorBot/1.0 (+https://github.com/seo-skills/seo-audit-skill)',
        },
        redirect: 'manual', // Don't auto-follow redirects
      });

      clearTimeout(timeoutId);

      // Check for redirect status codes
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (location) {
          // Resolve relative redirect URLs
          const nextUrl = new URL(location, currentUrl).href;
          chain.push(nextUrl);
          currentUrl = nextUrl;
          redirectCount++;
          continue;
        }
      }

      // Not a redirect or no location header
      return {
        finalUrl: currentUrl,
        statusCode: response.status,
        redirectCount,
        chain,
      };
    } catch (error) {
      clearTimeout(timeoutId);
      // Return current state on error
      return {
        finalUrl: currentUrl,
        statusCode: 0, // Network error
        redirectCount,
        chain,
      };
    }
  }

  // Max redirects reached
  return {
    finalUrl: currentUrl,
    statusCode: 0, // Treat as error
    redirectCount,
    chain,
  };
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
  const { links, invalidLinks } = extractLinks($, url);
  const specialLinks = extractSpecialLinks($);

  return {
    url,
    html,
    $,
    headers,
    statusCode,
    responseTime,
    cwv,
    links,
    images: extractImages($, url),
    invalidLinks,
    specialLinks,
  };
}
