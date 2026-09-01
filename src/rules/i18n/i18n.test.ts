import { describe, it, expect } from 'vitest';
import * as cheerio from 'cheerio';
import type { AuditContext, SiteContext, SitePageInfo } from '../../types.js';
import { hreflangConflictingRule } from './hreflang-conflicting.js';
import { hreflangRelativeUrlRule } from './hreflang-relative-url.js';
import { hreflangXDefaultRule } from './hreflang-x-default.js';
import { hreflangToBrokenRule } from './hreflang-to-broken.js';
import { hreflangToRedirectRule } from './hreflang-to-redirect.js';

/**
 * Helper to create an audit context from HTML
 */
function createContext(
  html: string,
  url = 'https://example.com/en/',
  headers: Record<string, string> = {},
  site?: SiteContext
): AuditContext {
  const $ = cheerio.load(html);
  return {
    url,
    html,
    $,
    headers,
    statusCode: 200,
    responseTime: 100,
    cwv: {},
    links: [],
    images: [],
    invalidLinks: [],
    specialLinks: [],
    figures: [],
    inlineSvgs: [],
    pictureElements: [],
    ...(site ? { site } : {}),
  };
}

/**
 * Build a minimal SiteContext whose only real content is the per-page crawl
 * inventory. Identity normalisation keeps the fixtures readable.
 */
function makeSiteWithPages(
  pages: Record<string, Partial<SitePageInfo> & { statusCode: number }>
): SiteContext {
  return {
    entryUrl: 'https://example.com/en/',
    pageCount: Object.keys(pages).length,
    depthByUrl: new Map(),
    inboundLinksByUrl: new Map(),
    outboundLinksByUrl: new Map(),
    normalize: (u: string) => u,
    pages: new Map(
      Object.entries(pages).map(([u, info]) => [
        u,
        {
          noindex: false,
          nofollow: false,
          disallowed: false,
          hreflangOut: {},
          ...info,
        },
      ])
    ),
  };
}

describe('i18n Rules', () => {
  describe('i18n-hreflang-relative-url', () => {
    it('should pass when no hreflang tags are present', async () => {
      const context = createContext('<html><head></head></html>');
      const result = await hreflangRelativeUrlRule.run(context);
      expect(result.status).toBe('pass');
    });

    it('should pass when all hreflang annotations use absolute URLs', async () => {
      const context = createContext(`
        <html><head>
          <link rel="alternate" hreflang="en" href="https://example.com/en/">
          <link rel="alternate" hreflang="fr" href="https://example.com/fr/">
          <link rel="alternate" hreflang="x-default" href="https://example.com/">
        </head></html>
      `);
      const result = await hreflangRelativeUrlRule.run(context);
      expect(result.status).toBe('pass');
      expect(result.score).toBe(100);
    });

    it('should fail when an hreflang annotation uses a relative URL', async () => {
      const context = createContext(`
        <html><head>
          <link rel="alternate" hreflang="en" href="https://example.com/en/">
          <link rel="alternate" hreflang="fr" href="/fr/">
        </head></html>
      `);
      const result = await hreflangRelativeUrlRule.run(context);
      expect(result.status).toBe('fail');
      expect(result.score).toBe(0);
      expect(result.details?.relativeCount).toBe(1);
      const annotations = result.details?.relativeAnnotations as Array<{
        hreflang: string;
        href: string;
      }>;
      expect(annotations[0]).toEqual({ hreflang: 'fr', href: '/fr/' });
    });

    it('should fail when an hreflang annotation uses a protocol-relative URL', async () => {
      const context = createContext(`
        <html><head>
          <link rel="alternate" hreflang="en" href="https://example.com/en/">
          <link rel="alternate" hreflang="de" href="//example.com/de/">
        </head></html>
      `);
      const result = await hreflangRelativeUrlRule.run(context);
      expect(result.status).toBe('fail');
      expect(result.details?.relativeCount).toBe(1);
    });

    it('should ignore annotations with an empty href', async () => {
      const context = createContext(`
        <html><head>
          <link rel="alternate" hreflang="en" href="https://example.com/en/">
          <link rel="alternate" hreflang="fr" href="">
        </head></html>
      `);
      const result = await hreflangRelativeUrlRule.run(context);
      expect(result.status).toBe('pass');
    });
  });

  describe('i18n-hreflang-conflicting', () => {
    it('should pass when no hreflang tags are present', async () => {
      const context = createContext('<html><head></head></html>');
      const result = await hreflangConflictingRule.run(context);
      expect(result.status).toBe('pass');
    });

    it('should pass when each language code points to exactly one URL', async () => {
      const context = createContext(`
        <html><head>
          <link rel="alternate" hreflang="en" href="https://example.com/en/">
          <link rel="alternate" hreflang="fr" href="https://example.com/fr/">
          <link rel="alternate" hreflang="x-default" href="https://example.com/">
        </head></html>
      `);
      const result = await hreflangConflictingRule.run(context);
      expect(result.status).toBe('pass');
    });

    it('should fail when the same language code points to multiple URLs', async () => {
      const context = createContext(`
        <html><head>
          <link rel="alternate" hreflang="en" href="https://example.com/en/">
          <link rel="alternate" hreflang="en" href="https://example.com/english/">
        </head></html>
      `);
      const result = await hreflangConflictingRule.run(context);
      expect(result.status).toBe('fail');
      expect(result.details?.conflictCount).toBe(1);
    });

    it('should fail when the same URL is targeted by multiple different language codes', async () => {
      const context = createContext(`
        <html><head>
          <link rel="alternate" hreflang="en" href="https://example.com/en/">
          <link rel="alternate" hreflang="en-us" href="https://example.com/en/">
          <link rel="alternate" hreflang="fr" href="https://example.com/fr/">
        </head></html>
      `);
      const result = await hreflangConflictingRule.run(context);
      expect(result.status).toBe('fail');
      const urlConflicts = result.details?.urlConflicts as Array<{
        url: string;
        hreflangs: string[];
      }>;
      expect(urlConflicts).toHaveLength(1);
      expect(urlConflicts[0].url).toBe('https://example.com/en/');
      expect(urlConflicts[0].hreflangs).toEqual(['en', 'en-us']);
    });

    it('should fail when the page self-references under multiple different language codes', async () => {
      const context = createContext(
        `
        <html><head>
          <link rel="alternate" hreflang="en" href="https://example.com/en/">
          <link rel="alternate" hreflang="en-gb" href="https://example.com/en/">
          <link rel="alternate" hreflang="fr" href="https://example.com/fr/">
        </head></html>
      `,
        'https://example.com/en/'
      );
      const result = await hreflangConflictingRule.run(context);
      expect(result.status).toBe('fail');
      expect(result.details?.selfReferencingLangs).toEqual(['en', 'en-gb']);
    });

    it('should not fail when a language annotation shares its target with x-default', async () => {
      const context = createContext(`
        <html><head>
          <link rel="alternate" hreflang="en" href="https://example.com/en/">
          <link rel="alternate" hreflang="fr" href="https://example.com/fr/">
          <link rel="alternate" hreflang="x-default" href="https://example.com/en/">
        </head></html>
      `);
      const result = await hreflangConflictingRule.run(context);
      expect(result.status).toBe('pass');
    });
  });

  describe('i18n-hreflang-x-default', () => {
    it('should pass when no hreflang tags are present', async () => {
      const context = createContext('<html><head></head></html>');
      const result = await hreflangXDefaultRule.run(context);
      expect(result.status).toBe('pass');
    });

    it('should pass when there is no x-default annotation', async () => {
      const context = createContext(`
        <html><head>
          <link rel="alternate" hreflang="en" href="https://example.com/en/">
          <link rel="alternate" hreflang="fr" href="https://example.com/fr/">
        </head></html>
      `);
      const result = await hreflangXDefaultRule.run(context);
      expect(result.status).toBe('pass');
      expect(result.details?.hasXDefault).toBe(false);
    });

    it('should report the insight when an annotation duplicates the x-default target', async () => {
      const context = createContext(`
        <html><head>
          <link rel="alternate" hreflang="en" href="https://example.com/en/">
          <link rel="alternate" hreflang="fr" href="https://example.com/fr/">
          <link rel="alternate" hreflang="x-default" href="https://example.com/en/">
        </head></html>
      `);
      const result = await hreflangXDefaultRule.run(context);
      expect(result.status).toBe('pass');
      expect(result.score).toBe(100);
      expect(result.details?.alsoXDefault).toBe(true);
      const overlapping = result.details?.overlapping as Array<{
        hreflang: string;
        href: string;
      }>;
      expect(overlapping).toHaveLength(1);
      expect(overlapping[0].hreflang).toBe('en');
    });

    it('should pass without the insight when x-default targets a distinct URL', async () => {
      const context = createContext(`
        <html><head>
          <link rel="alternate" hreflang="en" href="https://example.com/en/">
          <link rel="alternate" hreflang="fr" href="https://example.com/fr/">
          <link rel="alternate" hreflang="x-default" href="https://example.com/">
        </head></html>
      `);
      const result = await hreflangXDefaultRule.run(context);
      expect(result.status).toBe('pass');
      expect(result.details?.alsoXDefault).toBe(false);
    });
  });

  describe('i18n-hreflang-to-broken', () => {
    it('should pass when no hreflang tags are present', async () => {
      const context = createContext('<html><head></head></html>');
      const result = await hreflangToBrokenRule.run(context);
      expect(result.status).toBe('pass');
    });

    it('should fail on malformed hreflang URLs without crawl data (static check still runs)', async () => {
      const context = createContext(`
        <html><head>
          <link rel="alternate" hreflang="en" href="https://example.com/en/">
          <link rel="alternate" hreflang="fr" href="javascript:void(0)">
        </head></html>
      `);
      const result = await hreflangToBrokenRule.run(context);
      expect(result.status).toBe('fail');
      expect(result.details?.brokenCount).toBe(1);
    });

    it('should fail when a crawled hreflang target returned a 4xx', async () => {
      const site = makeSiteWithPages({
        'https://example.com/en/': { statusCode: 200 },
        'https://example.com/fr/': { statusCode: 404 },
      });
      const context = createContext(
        `
        <html><head>
          <link rel="alternate" hreflang="en" href="https://example.com/en/">
          <link rel="alternate" hreflang="fr" href="https://example.com/fr/">
        </head></html>
      `,
        'https://example.com/en/',
        {},
        site
      );
      const result = await hreflangToBrokenRule.run(context);
      expect(result.status).toBe('fail');
      expect(result.details?.errorCount).toBe(1);
      const errorUrls = result.details?.errorUrls as Array<{ href: string; statusCode: number }>;
      expect(errorUrls[0]).toEqual({
        hreflang: 'fr',
        href: 'https://example.com/fr/',
        statusCode: 404,
      });
    });

    it('should fail when a crawled hreflang target returned a 5xx', async () => {
      const site = makeSiteWithPages({
        'https://example.com/fr/': { statusCode: 503 },
      });
      const context = createContext(
        `
        <html><head>
          <link rel="alternate" hreflang="fr" href="https://example.com/fr/">
        </head></html>
      `,
        'https://example.com/en/',
        {},
        site
      );
      const result = await hreflangToBrokenRule.run(context);
      expect(result.status).toBe('fail');
      expect(result.details?.errorCount).toBe(1);
    });

    it('should warn when a crawled hreflang target timed out (statusCode 0)', async () => {
      const site = makeSiteWithPages({
        'https://example.com/fr/': { statusCode: 0 },
      });
      const context = createContext(
        `
        <html><head>
          <link rel="alternate" hreflang="fr" href="https://example.com/fr/">
        </head></html>
      `,
        'https://example.com/en/',
        {},
        site
      );
      const result = await hreflangToBrokenRule.run(context);
      expect(result.status).toBe('warn');
      expect(result.weight).not.toBe(0);
      expect(result.details?.timeoutCount).toBe(1);
    });

    it('should pass when every crawled hreflang target returned 200', async () => {
      const site = makeSiteWithPages({
        'https://example.com/en/': { statusCode: 200 },
        'https://example.com/fr/': { statusCode: 200 },
      });
      const context = createContext(
        `
        <html><head>
          <link rel="alternate" hreflang="en" href="https://example.com/en/">
          <link rel="alternate" hreflang="fr" href="https://example.com/fr/">
        </head></html>
      `,
        'https://example.com/en/',
        {},
        site
      );
      const result = await hreflangToBrokenRule.run(context);
      expect(result.status).toBe('pass');
    });

    it('should skip hreflang targets the crawl never visited', async () => {
      const site = makeSiteWithPages({
        'https://example.com/en/': { statusCode: 200 },
      });
      const context = createContext(
        `
        <html><head>
          <link rel="alternate" hreflang="en" href="https://example.com/en/">
          <link rel="alternate" hreflang="fr" href="https://example.com/fr/">
        </head></html>
      `,
        'https://example.com/en/',
        {},
        site
      );
      const result = await hreflangToBrokenRule.run(context);
      expect(result.status).toBe('pass');
    });
  });

  describe('i18n-hreflang-to-redirect', () => {
    it('should pass when no hreflang tags are present', async () => {
      const context = createContext('<html><head></head></html>');
      const result = await hreflangToRedirectRule.run(context);
      expect(result.status).toBe('pass');
    });

    it('should warn on HTTP hreflang URLs on an HTTPS page without crawl data (existing heuristic)', async () => {
      const context = createContext(`
        <html><head>
          <link rel="alternate" hreflang="en" href="https://example.com/en/">
          <link rel="alternate" hreflang="fr" href="http://example.com/fr/">
        </head></html>
      `);
      const result = await hreflangToRedirectRule.run(context);
      expect(result.status).toBe('warn');
      expect(result.details?.httpCount).toBe(1);
    });

    it('should pass when all hreflang URLs use HTTPS and no crawl data is available', async () => {
      const context = createContext(`
        <html><head>
          <link rel="alternate" hreflang="en" href="https://example.com/en/">
          <link rel="alternate" hreflang="fr" href="https://example.com/fr/">
        </head></html>
      `);
      const result = await hreflangToRedirectRule.run(context);
      expect(result.status).toBe('pass');
    });

    it('should warn when a crawled hreflang target returned a 3xx', async () => {
      const site = makeSiteWithPages({
        'https://example.com/en/': { statusCode: 200 },
        'https://example.com/fr/': { statusCode: 301 },
      });
      const context = createContext(
        `
        <html><head>
          <link rel="alternate" hreflang="en" href="https://example.com/en/">
          <link rel="alternate" hreflang="fr" href="https://example.com/fr/">
        </head></html>
      `,
        'https://example.com/en/',
        {},
        site
      );
      const result = await hreflangToRedirectRule.run(context);
      expect(result.status).toBe('warn');
      expect(result.details?.redirectCount).toBe(1);
      const redirecting = result.details?.redirectingUrls as Array<{
        href: string;
        statusCode: number;
      }>;
      expect(redirecting[0].statusCode).toBe(301);
    });

    it('should apply the crawl redirect check even when the current page is HTTP', async () => {
      const site = makeSiteWithPages({
        'http://example.com/fr/': { statusCode: 302 },
      });
      const context = createContext(
        `
        <html><head>
          <link rel="alternate" hreflang="fr" href="http://example.com/fr/">
        </head></html>
      `,
        'http://example.com/en/',
        {},
        site
      );
      const result = await hreflangToRedirectRule.run(context);
      expect(result.status).toBe('warn');
      expect(result.details?.redirectCount).toBe(1);
    });

    it('should pass when crawled hreflang targets did not redirect', async () => {
      const site = makeSiteWithPages({
        'https://example.com/en/': { statusCode: 200 },
        'https://example.com/fr/': { statusCode: 200 },
      });
      const context = createContext(
        `
        <html><head>
          <link rel="alternate" hreflang="en" href="https://example.com/en/">
          <link rel="alternate" hreflang="fr" href="https://example.com/fr/">
        </head></html>
      `,
        'https://example.com/en/',
        {},
        site
      );
      const result = await hreflangToRedirectRule.run(context);
      expect(result.status).toBe('pass');
    });

    it('should combine the protocol heuristic and crawl redirects in one warning', async () => {
      const site = makeSiteWithPages({
        'https://example.com/fr/': { statusCode: 301 },
      });
      const context = createContext(
        `
        <html><head>
          <link rel="alternate" hreflang="fr" href="https://example.com/fr/">
          <link rel="alternate" hreflang="de" href="http://example.com/de/">
        </head></html>
      `,
        'https://example.com/en/',
        {},
        site
      );
      const result = await hreflangToRedirectRule.run(context);
      expect(result.status).toBe('warn');
      expect(result.details?.httpCount).toBe(1);
      expect(result.details?.redirectCount).toBe(1);
    });
  });
});
