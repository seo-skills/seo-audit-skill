import { describe, it, expect } from 'vitest';
import * as cheerio from 'cheerio';
import type { AuditContext } from '../../types.js';
import { schemaNoindexConflictRule } from './schema-noindex-conflict.js';
import { paginationCanonicalRule } from './pagination-canonical.js';

/**
 * Helper to create an audit context from HTML
 */
function createContext(
  html: string,
  url = 'https://example.com',
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

describe('Crawlability Rules', () => {
  describe('crawl-schema-noindex-conflict', () => {
    it('should pass when page is indexable with rich schema', async () => {
      const context = createContext(`
        <html><head>
          <script type="application/ld+json">
            {"@context": "https://schema.org", "@type": "Article", "headline": "Test"}
          </script>
        </head></html>
      `);
      const result = await schemaNoindexConflictRule.run(context);
      expect(result.status).toBe('pass');
      expect(result.details.isNoindexed).toBe(false);
    });

    it('should pass when page is noindexed but has no rich schema', async () => {
      const context = createContext(`
        <html><head>
          <meta name="robots" content="noindex">
        </head></html>
      `);
      const result = await schemaNoindexConflictRule.run(context);
      expect(result.status).toBe('pass');
    });

    it('should fail when page has Article schema but is noindexed', async () => {
      const context = createContext(`
        <html><head>
          <meta name="robots" content="noindex">
          <script type="application/ld+json">
            {"@context": "https://schema.org", "@type": "Article", "headline": "Test"}
          </script>
        </head></html>
      `);
      const result = await schemaNoindexConflictRule.run(context);
      expect(result.status).toBe('fail');
      expect(result.details.richResultTypes).toContain('Article');
    });

    it('should fail when page has Product schema but is noindexed via X-Robots-Tag', async () => {
      const context = createContext(
        `<html><head>
          <script type="application/ld+json">
            {"@context": "https://schema.org", "@type": "Product", "name": "Widget"}
          </script>
        </head></html>`,
        'https://example.com',
        { 'x-robots-tag': 'noindex' }
      );
      const result = await schemaNoindexConflictRule.run(context);
      expect(result.status).toBe('fail');
      expect(result.details.richResultTypes).toContain('Product');
    });

    it('should detect FAQPage schema conflict', async () => {
      const context = createContext(`
        <html><head>
          <meta name="googlebot" content="noindex">
          <script type="application/ld+json">
            {"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": []}
          </script>
        </head></html>
      `);
      const result = await schemaNoindexConflictRule.run(context);
      expect(result.status).toBe('fail');
      expect(result.details.richResultTypes).toContain('FAQPage');
    });

    it('should handle @graph format schema', async () => {
      const context = createContext(`
        <html><head>
          <meta name="robots" content="noindex">
          <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@graph": [
                {"@type": "WebPage", "name": "Page"},
                {"@type": "Recipe", "name": "Cake"}
              ]
            }
          </script>
        </head></html>
      `);
      const result = await schemaNoindexConflictRule.run(context);
      expect(result.status).toBe('fail');
      expect(result.details.richResultTypes).toContain('Recipe');
    });
  });

  describe('crawl-pagination-canonical', () => {
    it('should pass for non-paginated page', async () => {
      const context = createContext(
        '<html><head><link rel="canonical" href="https://example.com/page"></head></html>',
        'https://example.com/page'
      );
      const result = await paginationCanonicalRule.run(context);
      expect(result.status).toBe('pass');
      expect(result.details.isPaginated).toBe(false);
    });

    it('should pass when paginated page has self-referencing canonical', async () => {
      const context = createContext(
        '<html><head><link rel="canonical" href="https://example.com/articles?page=2"></head></html>',
        'https://example.com/articles?page=2'
      );
      const result = await paginationCanonicalRule.run(context);
      expect(result.status).toBe('pass');
      expect(result.details.isPaginated).toBe(true);
    });

    it('should fail when paginated page canonicalizes to page 1', async () => {
      const context = createContext(
        '<html><head><link rel="canonical" href="https://example.com/articles"></head></html>',
        'https://example.com/articles?page=3'
      );
      const result = await paginationCanonicalRule.run(context);
      expect(result.status).toBe('fail');
      expect(result.message).toContain('canonicalizes to page 1');
    });

    it('should detect pagination via path pattern /page/2/', async () => {
      const context = createContext(
        '<html><head><link rel="canonical" href="https://example.com/blog/page/2/"></head></html>',
        'https://example.com/blog/page/2/'
      );
      const result = await paginationCanonicalRule.run(context);
      expect(result.status).toBe('pass');
      expect(result.details.isPaginated).toBe(true);
    });

    it('should warn when paginated page is missing canonical', async () => {
      const context = createContext(
        '<html><head></head></html>',
        'https://example.com/articles?page=2'
      );
      const result = await paginationCanonicalRule.run(context);
      expect(result.status).toBe('warn');
      expect(result.message).toContain('missing canonical');
    });

    it('should detect pagination via rel=prev/next links', async () => {
      const context = createContext(`
        <html><head>
          <link rel="canonical" href="https://example.com/articles">
          <link rel="prev" href="https://example.com/articles?page=1">
          <link rel="next" href="https://example.com/articles?page=3">
        </head></html>`,
        'https://example.com/articles'
      );
      const result = await paginationCanonicalRule.run(context);
      expect(result.details.hasPrevLink).toBe(true);
      expect(result.details.hasNextLink).toBe(true);
    });

    it('should handle various pagination query params', async () => {
      // Test ?p= param
      const context1 = createContext(
        '<html><head><link rel="canonical" href="https://example.com/list?p=5"></head></html>',
        'https://example.com/list?p=5'
      );
      const result1 = await paginationCanonicalRule.run(context1);
      expect(result1.details.isPaginated).toBe(true);

      // Test ?offset= param
      const context2 = createContext(
        '<html><head><link rel="canonical" href="https://example.com/list?offset=20"></head></html>',
        'https://example.com/list?offset=20'
      );
      const result2 = await paginationCanonicalRule.run(context2);
      expect(result2.details.isPaginated).toBe(true);
    });
  });
});
