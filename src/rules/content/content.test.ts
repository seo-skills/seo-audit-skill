import { describe, it, expect, beforeEach } from 'vitest';
import { load } from 'cheerio';
import type { AuditContext } from '../../types.js';
import { wordCountRule } from './word-count.js';
import { readingLevelRule } from './reading-level.js';
import { keywordStuffingRule } from './keyword-stuffing.js';
import { articleLinksRule } from './article-links.js';
import { authorInfoRule } from './author-info.js';
import { freshnessRule } from './freshness.js';
import { brokenHtmlRule } from './broken-html.js';
import { metaInBodyRule } from './meta-in-body.js';
import { mimeTypeRule } from './mime-type.js';
import {
  duplicateDescriptionRule,
  resetDescriptionRegistry,
  getDescriptionRegistryStats,
} from './duplicate-description.js';

/**
 * Create a mock AuditContext for testing
 */
function createContext(
  html: string,
  headers: Record<string, string> = {},
  url = 'https://example.com'
): AuditContext {
  const $ = load(html);

  // Extract links from HTML
  const links: AuditContext['links'] = [];
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const text = $(el).text().trim();
    const isInternal = href.startsWith('/') || href.includes('example.com');
    const isNoFollow = $(el).attr('rel')?.includes('nofollow') || false;
    links.push({ href, text, isInternal, isNoFollow });
  });

  return {
    url,
    html,
    $,
    headers,
    statusCode: 200,
    responseTime: 100,
    cwv: {},
    links,
    images: [],
  };
}

/**
 * Generate text with specified word count using varied vocabulary
 */
function generateText(wordCount: number): string {
  // Large vocabulary to avoid keyword stuffing detection
  const words = [
    'the', 'quick', 'brown', 'fox', 'jumps', 'over', 'lazy', 'dog',
    'technology', 'business', 'science', 'education', 'health', 'sports',
    'music', 'art', 'travel', 'food', 'fashion', 'politics', 'economy',
    'environment', 'culture', 'history', 'literature', 'philosophy',
    'mathematics', 'physics', 'chemistry', 'biology', 'astronomy',
    'geography', 'psychology', 'sociology', 'anthropology', 'linguistics',
    'architecture', 'engineering', 'medicine', 'law', 'finance',
    'marketing', 'management', 'design', 'photography', 'film',
    'theater', 'dance', 'painting', 'sculpture', 'poetry', 'novel',
    'essay', 'journalism', 'broadcasting', 'publishing', 'advertising',
    'research', 'development', 'innovation', 'creativity', 'imagination',
    'inspiration', 'motivation', 'dedication', 'perseverance', 'success',
    'achievement', 'excellence', 'quality', 'performance', 'efficiency',
    'productivity', 'sustainability', 'responsibility', 'integrity', 'trust',
    'respect', 'collaboration', 'communication', 'leadership', 'teamwork',
    'strategy', 'planning', 'execution', 'evaluation', 'improvement',
    'growth', 'expansion', 'diversification', 'specialization', 'focus',
    'clarity', 'precision', 'accuracy', 'reliability', 'consistency',
  ];
  const result: string[] = [];
  for (let i = 0; i < wordCount; i++) {
    result.push(words[i % words.length]);
  }
  return result.join(' ');
}

describe('Content Rules', () => {
  describe('wordCountRule', () => {
    it('should pass for content with 300+ words', async () => {
      const html = `<html><body><article>${generateText(350)}</article></body></html>`;
      const context = createContext(html);
      const result = await wordCountRule.run(context);
      expect(result.status).toBe('pass');
      expect(result.message).toContain('Adequate content length');
    });

    it('should warn for thin content (< 300 words)', async () => {
      const html = `<html><body><article>${generateText(200)}</article></body></html>`;
      const context = createContext(html);
      const result = await wordCountRule.run(context);
      expect(result.status).toBe('warn');
      expect(result.message).toContain('Thin content');
    });

    it('should fail for extremely thin content (< 100 words)', async () => {
      const html = `<html><body><article>${generateText(50)}</article></body></html>`;
      const context = createContext(html);
      const result = await wordCountRule.run(context);
      expect(result.status).toBe('fail');
      expect(result.message).toContain('Extremely thin');
    });

    it('should exclude nav/footer from word count', async () => {
      const html = `<html><body>
        <nav>${generateText(200)}</nav>
        <article>${generateText(50)}</article>
        <footer>${generateText(200)}</footer>
      </body></html>`;
      const context = createContext(html);
      const result = await wordCountRule.run(context);
      // Should only count the 50 words in article
      expect(result.status).toBe('fail');
    });
  });

  describe('readingLevelRule', () => {
    it('should pass for readable content (score 60-70)', async () => {
      // Simple, readable content
      const html = `<html><body><article>
        The cat sat on the mat. The dog ran in the park.
        Birds fly in the sky. Fish swim in the sea.
        Children play in the garden. Parents watch them carefully.
        The sun shines bright today. Clouds float in the blue sky.
        Life is simple and good. We enjoy each moment.
      </article></body></html>`;
      const context = createContext(html);
      const result = await readingLevelRule.run(context);
      // Actual score may vary, but should be in acceptable range
      expect(['pass', 'warn']).toContain(result.status);
    });

    it('should skip check for very short content', async () => {
      const html = '<html><body><article>Short text.</article></body></html>';
      const context = createContext(html);
      const result = await readingLevelRule.run(context);
      expect(result.status).toBe('pass');
      expect(result.details?.skipped).toBe(true);
    });

    it('should provide reading level description', async () => {
      const html = `<html><body><article>${generateText(100)}</article></body></html>`;
      const context = createContext(html);
      const result = await readingLevelRule.run(context);
      expect(result.details?.levelDescription).toBeDefined();
    });
  });

  describe('keywordStuffingRule', () => {
    it('should pass when no word exceeds 2% density', async () => {
      const html = `<html><body><article>${generateText(200)}</article></body></html>`;
      const context = createContext(html);
      const result = await keywordStuffingRule.run(context);
      expect(result.status).toBe('pass');
    });

    it('should warn when keyword density is high', async () => {
      // Repeat "keyword" many times
      const stuffedContent = 'keyword '.repeat(30) + generateText(100);
      const html = `<html><body><article>${stuffedContent}</article></body></html>`;
      const context = createContext(html);
      const result = await keywordStuffingRule.run(context);
      expect(['warn', 'fail']).toContain(result.status);
    });

    it('should skip check for very short content', async () => {
      const html = '<html><body><article>Short text here.</article></body></html>';
      const context = createContext(html);
      const result = await keywordStuffingRule.run(context);
      expect(result.status).toBe('pass');
      expect(result.details?.skipped).toBe(true);
    });

    it('should ignore stopwords in calculation', async () => {
      // "the" and other stopwords appear many times but should be ignored
      const stopwords = 'the and is are was were be been being have has had do does did will would could should may might must can shall ';
      const content = stopwords.repeat(10) + generateText(150);
      const html = `<html><body><article>${content}</article></body></html>`;
      const context = createContext(html);
      const result = await keywordStuffingRule.run(context);
      // Should pass because stopwords are filtered out
      expect(result.status).toBe('pass');
    });
  });

  describe('articleLinksRule', () => {
    it('should pass for appropriate link density', async () => {
      const links = '<a href="/page1">Link 1</a> <a href="/page2">Link 2</a> <a href="https://external.com">External</a>';
      const html = `<html><body><article>${generateText(200)} ${links}</article></body></html>`;
      const context = createContext(html);
      const result = await articleLinksRule.run(context);
      expect(result.status).toBe('pass');
    });

    it('should warn for too few links', async () => {
      const html = `<html><body><article>${generateText(500)}</article></body></html>`;
      const context = createContext(html);
      const result = await articleLinksRule.run(context);
      expect(result.status).toBe('warn');
      expect(result.message).toContain('too low');
    });

    it('should skip for short content', async () => {
      const html = `<html><body><article>${generateText(50)}</article></body></html>`;
      const context = createContext(html);
      const result = await articleLinksRule.run(context);
      expect(result.status).toBe('pass');
      expect(result.details?.skipped).toBe(true);
    });
  });

  describe('authorInfoRule', () => {
    it('should pass when schema.org author present', async () => {
      const html = `<html><head>
        <script type="application/ld+json">{"@type": "Article", "author": {"@type": "Person", "name": "John Doe"}}</script>
      </head><body></body></html>`;
      const context = createContext(html);
      const result = await authorInfoRule.run(context);
      expect(result.status).toBe('pass');
      expect(result.details?.signals).toContain('Schema.org author: "John Doe"');
    });

    it('should pass when rel=author link present', async () => {
      const html = '<html><body><a rel="author" href="/authors/john">John Doe</a></body></html>';
      const context = createContext(html);
      const result = await authorInfoRule.run(context);
      expect(result.status).toBe('pass');
    });

    it('should pass when meta author present', async () => {
      const html = '<html><head><meta name="author" content="John Doe"></head><body></body></html>';
      const context = createContext(html);
      const result = await authorInfoRule.run(context);
      expect(result.status).toBe('pass');
    });

    it('should warn when no author info found', async () => {
      const html = '<html><head></head><body><p>Content without author</p></body></html>';
      const context = createContext(html);
      const result = await authorInfoRule.run(context);
      expect(result.status).toBe('warn');
    });
  });

  describe('freshnessRule', () => {
    it('should pass when datePublished in JSON-LD', async () => {
      const html = `<html><head>
        <script type="application/ld+json">{"@type": "Article", "datePublished": "2024-01-15"}</script>
      </head><body></body></html>`;
      const context = createContext(html);
      const result = await freshnessRule.run(context);
      expect(result.status).toBe('pass');
    });

    it('should pass when time element with datetime', async () => {
      const html = '<html><body><time datetime="2024-01-15">January 15, 2024</time></body></html>';
      const context = createContext(html);
      const result = await freshnessRule.run(context);
      expect(result.status).toBe('pass');
    });

    it('should pass when article:published_time meta', async () => {
      const html = '<html><head><meta property="article:published_time" content="2024-01-15T10:00:00Z"></head><body></body></html>';
      const context = createContext(html);
      const result = await freshnessRule.run(context);
      expect(result.status).toBe('pass');
    });

    it('should pass when Last-Modified header present', async () => {
      const html = '<html><body></body></html>';
      const headers = { 'last-modified': 'Tue, 15 Jan 2024 10:00:00 GMT' };
      const context = createContext(html, headers);
      const result = await freshnessRule.run(context);
      expect(result.status).toBe('pass');
    });

    it('should warn when no date signals', async () => {
      const html = '<html><body><p>Content without dates</p></body></html>';
      const context = createContext(html);
      const result = await freshnessRule.run(context);
      expect(result.status).toBe('warn');
    });
  });

  describe('brokenHtmlRule', () => {
    it('should pass for valid HTML structure', async () => {
      const html = '<html><head><title>Test</title></head><body><h1>Title</h1><p>Content</p></body></html>';
      const context = createContext(html);
      const result = await brokenHtmlRule.run(context);
      expect(result.status).toBe('pass');
    });

    it('should warn for duplicate IDs', async () => {
      const html = '<html><body><div id="dup">One</div><div id="dup">Two</div></body></html>';
      const context = createContext(html);
      const result = await brokenHtmlRule.run(context);
      expect(result.status).toBe('warn');
      expect(result.details?.categories?.['duplicate-id']).toBe(1);
    });

    it('should warn for empty headings', async () => {
      const html = '<html><body><h1></h1><p>Content</p></body></html>';
      const context = createContext(html);
      const result = await brokenHtmlRule.run(context);
      expect(result.status).toBe('warn');
    });

    it('should fail for many issues', async () => {
      const html = `<html><body>
        <div id="a">1</div><div id="a">2</div>
        <div id="b">1</div><div id="b">2</div>
        <h1></h1><h2></h2>
        <img><img>
      </body></html>`;
      const context = createContext(html);
      const result = await brokenHtmlRule.run(context);
      expect(result.status).toBe('fail');
    });
  });

  describe('metaInBodyRule', () => {
    it('should pass when all meta in head', async () => {
      const html = '<html><head><meta name="description" content="Test"><title>Test</title></head><body></body></html>';
      const context = createContext(html);
      const result = await metaInBodyRule.run(context);
      expect(result.status).toBe('pass');
    });

    it('should fail when meta tag in body', async () => {
      const html = '<html><head></head><body><meta name="description" content="Wrong place"></body></html>';
      const context = createContext(html);
      const result = await metaInBodyRule.run(context);
      expect(result.status).toBe('fail');
    });

    it('should fail when title in body', async () => {
      const html = '<html><head></head><body><title>Wrong place</title></body></html>';
      const context = createContext(html);
      const result = await metaInBodyRule.run(context);
      expect(result.status).toBe('fail');
    });

    it('should fail when canonical in body', async () => {
      const html = '<html><head></head><body><link rel="canonical" href="https://example.com"></body></html>';
      const context = createContext(html);
      const result = await metaInBodyRule.run(context);
      expect(result.status).toBe('fail');
    });
  });

  describe('mimeTypeRule', () => {
    it('should pass for text/html with utf-8', async () => {
      const html = '<html><body></body></html>';
      const headers = { 'content-type': 'text/html; charset=utf-8' };
      const context = createContext(html, headers);
      const result = await mimeTypeRule.run(context);
      expect(result.status).toBe('pass');
    });

    it('should warn for missing charset', async () => {
      const html = '<html><body></body></html>';
      const headers = { 'content-type': 'text/html' };
      const context = createContext(html, headers);
      const result = await mimeTypeRule.run(context);
      expect(result.status).toBe('warn');
    });

    it('should warn for non-utf-8 charset', async () => {
      const html = '<html><body></body></html>';
      const headers = { 'content-type': 'text/html; charset=iso-8859-1' };
      const context = createContext(html, headers);
      const result = await mimeTypeRule.run(context);
      expect(result.status).toBe('warn');
    });

    it('should fail for wrong mime type', async () => {
      const html = '<html><body></body></html>';
      const headers = { 'content-type': 'application/json' };
      const context = createContext(html, headers);
      const result = await mimeTypeRule.run(context);
      expect(result.status).toBe('fail');
    });

    it('should fail for missing Content-Type header', async () => {
      const html = '<html><body></body></html>';
      const context = createContext(html, {});
      const result = await mimeTypeRule.run(context);
      expect(result.status).toBe('fail');
    });
  });

  describe('duplicateDescriptionRule', () => {
    beforeEach(() => {
      resetDescriptionRegistry();
    });

    it('should fail when no description present', async () => {
      const html = '<html><head></head><body></body></html>';
      const context = createContext(html);
      const result = await duplicateDescriptionRule.run(context);
      expect(result.status).toBe('fail');
      expect(result.message).toContain('no meta description');
    });

    it('should pass for unique description', async () => {
      const html = '<html><head><meta name="description" content="This is a unique page description that is long enough to be valid."></head><body></body></html>';
      const context = createContext(html, {}, 'https://example.com/page1');
      const result = await duplicateDescriptionRule.run(context);
      expect(result.status).toBe('pass');
      expect(result.message).toContain('unique');
    });

    it('should warn for duplicate descriptions', async () => {
      const desc = 'This is a duplicate description that appears on multiple pages for testing purposes.';
      const html1 = `<html><head><meta name="description" content="${desc}"></head></html>`;
      const html2 = `<html><head><meta name="description" content="${desc}"></head></html>`;

      const context1 = createContext(html1, {}, 'https://example.com/page1');
      const context2 = createContext(html2, {}, 'https://example.com/page2');

      await duplicateDescriptionRule.run(context1);
      const result = await duplicateDescriptionRule.run(context2);

      expect(result.status).toBe('warn');
      expect(result.message).toContain('Duplicate');
      expect(result.details?.duplicateUrls).toContain('https://example.com/page1');
    });

    it('should detect duplicates with different case', async () => {
      const html1 = '<html><head><meta name="description" content="Same Description Here for testing."></head></html>';
      const html2 = '<html><head><meta name="description" content="SAME DESCRIPTION HERE FOR TESTING."></head></html>';

      const context1 = createContext(html1, {}, 'https://example.com/page1');
      const context2 = createContext(html2, {}, 'https://example.com/page2');

      await duplicateDescriptionRule.run(context1);
      const result = await duplicateDescriptionRule.run(context2);

      expect(result.status).toBe('warn');
    });

    it('should track registry stats correctly', async () => {
      const html1 = '<html><head><meta name="description" content="Description A is unique and long enough."></head></html>';
      const html2 = '<html><head><meta name="description" content="Description B is also unique and long enough."></head></html>';
      const html3 = '<html><head><meta name="description" content="Description A is unique and long enough."></head></html>';

      await duplicateDescriptionRule.run(createContext(html1, {}, 'https://example.com/1'));
      await duplicateDescriptionRule.run(createContext(html2, {}, 'https://example.com/2'));
      await duplicateDescriptionRule.run(createContext(html3, {}, 'https://example.com/3'));

      const stats = getDescriptionRegistryStats();
      expect(stats.totalDescriptions).toBe(2);
      expect(stats.duplicateGroups).toBe(1);
    });

    it('should reset registry between audits', async () => {
      const html = '<html><head><meta name="description" content="Test description that is long enough for validation."></head></html>';

      await duplicateDescriptionRule.run(createContext(html, {}, 'https://example.com/1'));
      resetDescriptionRegistry();

      const result = await duplicateDescriptionRule.run(createContext(html, {}, 'https://example.com/2'));
      expect(result.status).toBe('pass'); // No duplicate after reset
    });
  });
});
