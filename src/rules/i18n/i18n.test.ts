import { describe, it, expect } from 'vitest';
import * as cheerio from 'cheerio';
import type { AuditContext } from '../../types.js';
import { hreflangConflictingRule } from './hreflang-conflicting.js';
import { hreflangRelativeUrlRule } from './hreflang-relative-url.js';
import { hreflangXDefaultRule } from './hreflang-x-default.js';

/**
 * Helper to create an audit context from HTML
 */
function createContext(
  html: string,
  url = 'https://example.com/en/',
  headers: Record<string, string> = {}
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
});
