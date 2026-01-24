import { describe, it, expect, beforeEach } from 'vitest';
import { load } from 'cheerio';
import type { AuditContext } from '../../types.js';
import { canonicalHeaderRule } from './canonical-header.js';
import { nosnippetRule } from './nosnippet.js';
import { robotsMetaRule } from './robots-meta.js';
import { titleUniqueRule, resetTitleRegistry, getTitleRegistryStats } from './title-unique.js';

/**
 * Create a mock AuditContext for testing
 */
function createContext(html: string, headers: Record<string, string> = {}, url = 'https://example.com'): AuditContext {
  return {
    url,
    html,
    $: load(html),
    headers,
    statusCode: 200,
    responseTime: 100,
    cwv: {},
    links: [],
    images: [],
  };
}

describe('Core SEO Rules', () => {
  describe('canonicalHeaderRule', () => {
    it('should pass when neither HTML canonical nor Link header exists', async () => {
      const context = createContext('<html><head></head><body></body></html>');
      const result = await canonicalHeaderRule.run(context);
      expect(result.status).toBe('pass');
      expect(result.message).toContain('No conflicting canonical signals');
    });

    it('should pass when only HTML canonical exists', async () => {
      const html = '<html><head><link rel="canonical" href="https://example.com/page"></head></html>';
      const context = createContext(html);
      const result = await canonicalHeaderRule.run(context);
      expect(result.status).toBe('pass');
      expect(result.message).toContain('Single canonical signal');
      expect(result.details?.source).toBe('html');
    });

    it('should pass when only Link header exists', async () => {
      const html = '<html><head></head></html>';
      const headers = { link: '<https://example.com/page>; rel="canonical"' };
      const context = createContext(html, headers);
      const result = await canonicalHeaderRule.run(context);
      expect(result.status).toBe('pass');
      expect(result.message).toContain('Single canonical signal');
      expect(result.details?.source).toBe('header');
    });

    it('should pass when both exist and match', async () => {
      const html = '<html><head><link rel="canonical" href="https://example.com/page"></head></html>';
      const headers = { link: '<https://example.com/page>; rel="canonical"' };
      const context = createContext(html, headers);
      const result = await canonicalHeaderRule.run(context);
      expect(result.status).toBe('pass');
      expect(result.message).toContain('match');
    });

    it('should pass when both match with trailing slash difference', async () => {
      const html = '<html><head><link rel="canonical" href="https://example.com/page/"></head></html>';
      const headers = { link: '<https://example.com/page>; rel="canonical"' };
      const context = createContext(html, headers);
      const result = await canonicalHeaderRule.run(context);
      expect(result.status).toBe('pass');
    });

    it('should warn when both exist but differ', async () => {
      const html = '<html><head><link rel="canonical" href="https://example.com/page1"></head></html>';
      const headers = { link: '<https://example.com/page2>; rel="canonical"' };
      const context = createContext(html, headers);
      const result = await canonicalHeaderRule.run(context);
      expect(result.status).toBe('warn');
      expect(result.message).toContain('mismatch');
      expect(result.details?.htmlCanonical).toBe('https://example.com/page1');
      expect(result.details?.headerCanonical).toBe('https://example.com/page2');
    });
  });

  describe('nosnippetRule', () => {
    it('should pass when no nosnippet directive exists', async () => {
      const html = '<html><head><meta name="robots" content="index, follow"></head></html>';
      const context = createContext(html);
      const result = await nosnippetRule.run(context);
      expect(result.status).toBe('pass');
      expect(result.message).toContain('allows search engine snippets');
    });

    it('should pass with no robots meta tag', async () => {
      const html = '<html><head></head></html>';
      const context = createContext(html);
      const result = await nosnippetRule.run(context);
      expect(result.status).toBe('pass');
    });

    it('should warn when nosnippet is in robots meta', async () => {
      const html = '<html><head><meta name="robots" content="nosnippet"></head></html>';
      const context = createContext(html);
      const result = await nosnippetRule.run(context);
      expect(result.status).toBe('warn');
      expect(result.message).toContain('blocks search snippets');
      expect(result.details?.issues).toContain('Meta robots contains "nosnippet"');
    });

    it('should warn when max-snippet:0 is present', async () => {
      const html = '<html><head><meta name="robots" content="max-snippet:0"></head></html>';
      const context = createContext(html);
      const result = await nosnippetRule.run(context);
      expect(result.status).toBe('warn');
      expect(result.message).toContain('blocks search snippets');
    });

    it('should pass when max-snippet has positive value', async () => {
      const html = '<html><head><meta name="robots" content="max-snippet:160"></head></html>';
      const context = createContext(html);
      const result = await nosnippetRule.run(context);
      expect(result.status).toBe('pass');
    });

    it('should warn when nosnippet is in googlebot meta', async () => {
      const html = '<html><head><meta name="googlebot" content="nosnippet"></head></html>';
      const context = createContext(html);
      const result = await nosnippetRule.run(context);
      expect(result.status).toBe('warn');
      expect(result.details?.issues).toContain('Meta googlebot contains "nosnippet"');
    });

    it('should warn when nosnippet is in X-Robots-Tag header', async () => {
      const html = '<html><head></head></html>';
      const headers = { 'x-robots-tag': 'nosnippet' };
      const context = createContext(html, headers);
      const result = await nosnippetRule.run(context);
      expect(result.status).toBe('warn');
      expect(result.details?.issues).toContain('X-Robots-Tag header contains "nosnippet"');
    });
  });

  describe('robotsMetaRule', () => {
    it('should pass with no robots meta tag (default behavior)', async () => {
      const html = '<html><head></head></html>';
      const context = createContext(html);
      const result = await robotsMetaRule.run(context);
      expect(result.status).toBe('pass');
      expect(result.message).toContain('No robots meta tag found');
      expect(result.details?.defaultBehavior).toBe('index, follow');
    });

    it('should pass with index, follow', async () => {
      const html = '<html><head><meta name="robots" content="index, follow"></head></html>';
      const context = createContext(html);
      const result = await robotsMetaRule.run(context);
      expect(result.status).toBe('pass');
      expect(result.message).toContain('allow indexing');
    });

    it('should warn when noindex is present', async () => {
      const html = '<html><head><meta name="robots" content="noindex"></head></html>';
      const context = createContext(html);
      const result = await robotsMetaRule.run(context);
      expect(result.status).toBe('warn');
      expect(result.message).toContain('Restrictive indexing directives');
      expect(result.details?.issues).toContain('robots: "noindex"');
    });

    it('should warn when nofollow is present', async () => {
      const html = '<html><head><meta name="robots" content="nofollow"></head></html>';
      const context = createContext(html);
      const result = await robotsMetaRule.run(context);
      expect(result.status).toBe('warn');
      expect(result.details?.issues).toContain('robots: "nofollow"');
    });

    it('should warn when noarchive is present', async () => {
      const html = '<html><head><meta name="robots" content="noarchive"></head></html>';
      const context = createContext(html);
      const result = await robotsMetaRule.run(context);
      expect(result.status).toBe('warn');
      expect(result.details?.issues).toContain('robots: "noarchive"');
    });

    it('should warn when none is present (equivalent to noindex, nofollow)', async () => {
      const html = '<html><head><meta name="robots" content="none"></head></html>';
      const context = createContext(html);
      const result = await robotsMetaRule.run(context);
      expect(result.status).toBe('warn');
      expect(result.details?.issues).toContain('robots: "none"');
    });

    it('should warn for googlebot specific noindex', async () => {
      const html = '<html><head><meta name="googlebot" content="noindex"></head></html>';
      const context = createContext(html);
      const result = await robotsMetaRule.run(context);
      expect(result.status).toBe('warn');
      expect(result.details?.issues).toContain('googlebot: "noindex"');
    });

    it('should warn for X-Robots-Tag header', async () => {
      const html = '<html><head></head></html>';
      const headers = { 'x-robots-tag': 'noindex' };
      const context = createContext(html, headers);
      const result = await robotsMetaRule.run(context);
      expect(result.status).toBe('warn');
      expect(result.details?.issues).toContain('X-Robots-Tag: "noindex"');
    });
  });

  describe('titleUniqueRule', () => {
    beforeEach(() => {
      resetTitleRegistry();
    });

    it('should fail when page has no title', async () => {
      const html = '<html><head></head></html>';
      const context = createContext(html);
      const result = await titleUniqueRule.run(context);
      expect(result.status).toBe('fail');
      expect(result.message).toContain('no title tag');
    });

    it('should pass for first occurrence of a title', async () => {
      const html = '<html><head><title>Unique Page Title</title></head></html>';
      const context = createContext(html, {}, 'https://example.com/page1');
      const result = await titleUniqueRule.run(context);
      expect(result.status).toBe('pass');
      expect(result.message).toContain('unique');
    });

    it('should warn for duplicate titles', async () => {
      const html1 = '<html><head><title>Same Title</title></head></html>';
      const html2 = '<html><head><title>Same Title</title></head></html>';

      const context1 = createContext(html1, {}, 'https://example.com/page1');
      const context2 = createContext(html2, {}, 'https://example.com/page2');

      await titleUniqueRule.run(context1);
      const result = await titleUniqueRule.run(context2);

      expect(result.status).toBe('warn');
      expect(result.message).toContain('Duplicate title');
      expect(result.details?.duplicateUrls).toContain('https://example.com/page1');
      expect(result.details?.duplicateUrls).toContain('https://example.com/page2');
    });

    it('should detect duplicates with different case', async () => {
      const html1 = '<html><head><title>Same Title</title></head></html>';
      const html2 = '<html><head><title>SAME TITLE</title></head></html>';

      const context1 = createContext(html1, {}, 'https://example.com/page1');
      const context2 = createContext(html2, {}, 'https://example.com/page2');

      await titleUniqueRule.run(context1);
      const result = await titleUniqueRule.run(context2);

      expect(result.status).toBe('warn');
    });

    it('should track registry stats correctly', async () => {
      const html1 = '<html><head><title>Title A</title></head></html>';
      const html2 = '<html><head><title>Title B</title></head></html>';
      const html3 = '<html><head><title>Title A</title></head></html>'; // Duplicate

      await titleUniqueRule.run(createContext(html1, {}, 'https://example.com/1'));
      await titleUniqueRule.run(createContext(html2, {}, 'https://example.com/2'));
      await titleUniqueRule.run(createContext(html3, {}, 'https://example.com/3'));

      const stats = getTitleRegistryStats();
      expect(stats.totalTitles).toBe(2);
      expect(stats.duplicateGroups).toBe(1);
    });

    it('should reset registry between audits', async () => {
      const html = '<html><head><title>Test Title</title></head></html>';

      await titleUniqueRule.run(createContext(html, {}, 'https://example.com/1'));
      resetTitleRegistry();

      const result = await titleUniqueRule.run(createContext(html, {}, 'https://example.com/2'));
      expect(result.status).toBe('pass'); // No duplicate after reset
    });
  });
});
