import { describe, it, expect, beforeEach } from 'vitest';
import { load } from 'cheerio';
import type { AuditContext, SiteContext } from '../../types.js';
import { canonicalHeaderRule } from './canonical-header.js';
import { nosnippetRule } from './nosnippet.js';
import { robotsMetaRule } from './robots-meta.js';
import { titleUniqueRule } from './title-unique.js';
import { createTestSite } from '../test-context.js';
import { canonicalOutsideHeadRule } from './canonical-outside-head.js';
import { canonicalAttributesRule } from './canonical-attributes.js';
import { canonicalMultipleRule } from './canonical-multiple.js';
import { canonicalExternalRule } from './canonical-external.js';
import { robotsDirectiveMismatchRule } from './robots-directive-mismatch.js';
import { createTestContext } from '../test-context.js';

/**
 * Create a mock AuditContext for testing
 */
function createContext(html: string, headers: Record<string, string> = {}, url = 'https://example.com'): AuditContext {
  return createTestContext(html, { url, headers });
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
    // core-title-unique compares pages, so it reads a whole crawl.
    const titled = (title: string, head = '') => `<html><head><title>${title}</title>${head}</head><body></body></html>`;
    const statusOf = async (pages: Array<{ url: string; html: string }>, url: string) => {
      const { contexts } = await createTestSite(pages);
      return titleUniqueRule.run(contexts.get(url)!);
    };

    it('should fail when page has no title', async () => {
      const result = await statusOf([{ url: 'https://example.com/', html: '<html><head></head></html>' }], 'https://example.com/');
      expect(result.status).toBe('fail');
      expect(result.message).toContain('no title tag');
    });

    it('should pass for a unique title', async () => {
      const result = await statusOf(
        [
          { url: 'https://example.com/page1', html: titled('Unique Page Title') },
          { url: 'https://example.com/page2', html: titled('Another Title') },
        ],
        'https://example.com/page1'
      );
      expect(result.status).toBe('pass');
      expect(result.message).toContain('unique');
    });

    it('flags every page in a duplicate group, the first one included', async () => {
      const pages = [
        { url: 'https://example.com/page1', html: titled('Same Title') },
        { url: 'https://example.com/page2', html: titled('Same Title') },
      ];
      const first = await statusOf(pages, 'https://example.com/page1');
      const second = await statusOf(pages, 'https://example.com/page2');
      expect(first.status).toBe('warn');
      expect(second.status).toBe('warn');
      expect(second.message).toContain('Duplicate title');
      expect(second.details?.duplicateUrls).toEqual(['https://example.com/page1']);
    });

    it('should detect duplicates with different case', async () => {
      const result = await statusOf(
        [
          { url: 'https://example.com/page1', html: titled('Same Title') },
          { url: 'https://example.com/page2', html: titled('SAME TITLE') },
        ],
        'https://example.com/page1'
      );
      expect(result.status).toBe('warn');
    });

    it('does not compare a later page of a paginated archive', async () => {
      const result = await statusOf(
        [
          { url: 'https://example.com/blog', html: titled('Blog') },
          { url: 'https://example.com/blog/page/2', html: titled('Blog') },
        ],
        'https://example.com/blog'
      );
      expect(result.status).toBe('pass');
    });

    it('does not compare a variant canonicalised to the base URL', async () => {
      const pages = [
        { url: 'https://example.com/shirt', html: titled('Shirt') },
        { url: 'https://example.com/shirt?color=red', html: titled('Shirt', '<link rel="canonical" href="https://example.com/shirt">') },
      ];
      expect((await statusOf(pages, 'https://example.com/shirt')).status).toBe('pass');
      const variant = await statusOf(pages, 'https://example.com/shirt?color=red');
      expect(variant.status).toBe('not-measured');
      expect(variant.reason).toBe('not-compared');
    });

    it('is not measured outside a crawl', async () => {
      const result = await titleUniqueRule.run(createContext(titled('Alone')));
      expect(result.status).toBe('not-measured');
      expect(result.reason).toBe('not-applicable');
    });
  });

  describe('canonicalOutsideHeadRule', () => {
    it('should pass when the canonical is inside the <head>', async () => {
      const html = '<html><head><link rel="canonical" href="https://example.com/"></head><body></body></html>';
      const context = createContext(html);
      const result = await canonicalOutsideHeadRule.run(context);
      expect(result.status).toBe('pass');
      expect(result.details?.outsideHead).toBe(0);
    });

    it('should pass when no canonical exists at all', async () => {
      const html = '<html><head></head><body></body></html>';
      const context = createContext(html);
      const result = await canonicalOutsideHeadRule.run(context);
      expect(result.status).toBe('pass');
    });

    it('should fail when the canonical is in the <body>', async () => {
      const html = '<html><head><title>t</title></head><body><link rel="canonical" href="https://example.com/"></body></html>';
      const context = createContext(html);
      const result = await canonicalOutsideHeadRule.run(context);
      expect(result.status).toBe('fail');
      expect(result.details?.outsideHead).toBe(1);
      expect(result.details?.hrefs).toContain('https://example.com/');
    });

    it('should fail when a canonical is in the <head> and another in the <body>', async () => {
      const html = '<html><head><link rel="canonical" href="https://example.com/"></head><body><link rel="canonical" href="https://example.com/dup"></body></html>';
      const context = createContext(html);
      const result = await canonicalOutsideHeadRule.run(context);
      expect(result.status).toBe('fail');
      expect(result.details?.outsideHead).toBe(1);
      expect(result.details?.hrefs).toEqual(['https://example.com/dup']);
    });
  });

  describe('canonicalAttributesRule', () => {
    it('should pass when the canonical carries only rel and href', async () => {
      const html = '<html><head><link rel="canonical" href="https://example.com/"></head></html>';
      const context = createContext(html);
      const result = await canonicalAttributesRule.run(context);
      expect(result.status).toBe('pass');
    });

    it('should pass when no canonical exists at all', async () => {
      const html = '<html><head></head><body></body></html>';
      const context = createContext(html);
      const result = await canonicalAttributesRule.run(context);
      expect(result.status).toBe('pass');
      expect(result.details?.found).toBe(false);
    });

    it('should fail when the canonical carries a type attribute', async () => {
      const html = '<html><head><link rel="canonical" href="https://example.com/" type="text/html"></head></html>';
      const context = createContext(html);
      const result = await canonicalAttributesRule.run(context);
      expect(result.status).toBe('fail');
      expect(result.details?.invalidAttributes).toContain('type');
    });

    it('should fail when the canonical carries an hreflang attribute', async () => {
      const html = '<html><head><link rel="canonical" href="https://example.com/" hreflang="en"></head></html>';
      const context = createContext(html);
      const result = await canonicalAttributesRule.run(context);
      expect(result.status).toBe('fail');
      expect(result.details?.invalidAttributes).toContain('hreflang');
    });

    it('should warn when the canonical carries a superfluous attribute', async () => {
      const html = '<html><head><link rel="canonical" href="https://example.com/" data-testid="true"></head></html>';
      const context = createContext(html);
      const result = await canonicalAttributesRule.run(context);
      expect(result.status).toBe('warn');
      expect(result.details?.superfluousAttributes).toContain('data-testid');
    });

    it('should fail when invalid and superfluous attributes are combined', async () => {
      const html = '<html><head><link rel="canonical" href="https://example.com/" media="print" id="c"></head></html>';
      const context = createContext(html);
      const result = await canonicalAttributesRule.run(context);
      expect(result.status).toBe('fail');
      expect(result.details?.invalidAttributes).toContain('media');
      expect(result.details?.superfluousAttributes).toContain('id');
    });
  });

  describe('canonicalMultipleRule', () => {
    it('should pass when a single canonical exists', async () => {
      const html = '<html><head><link rel="canonical" href="https://example.com/"></head></html>';
      const context = createContext(html);
      const result = await canonicalMultipleRule.run(context);
      expect(result.status).toBe('pass');
      expect(result.details?.count).toBe(1);
    });

    it('should pass when no canonical exists at all', async () => {
      const html = '<html><head></head><body></body></html>';
      const context = createContext(html);
      const result = await canonicalMultipleRule.run(context);
      expect(result.status).toBe('pass');
      expect(result.details?.count).toBe(0);
    });

    it('should fail when multiple canonicals specify different URLs', async () => {
      const html = '<html><head><link rel="canonical" href="https://example.com/page-a"><link rel="canonical" href="https://example.com/page-b"></head></html>';
      const context = createContext(html);
      const result = await canonicalMultipleRule.run(context);
      expect(result.status).toBe('fail');
      expect(result.details?.count).toBe(2);
      expect(result.details?.match).toBe(false);
    });

    it('should warn when multiple canonicals specify the same URL', async () => {
      const html = '<html><head><link rel="canonical" href="https://example.com/"><link rel="canonical" href="https://example.com/"></head></html>';
      const context = createContext(html);
      const result = await canonicalMultipleRule.run(context);
      expect(result.status).toBe('warn');
      expect(result.details?.count).toBe(2);
      expect(result.details?.match).toBe(true);
    });

    it('should warn for duplicates that differ only by trailing slash', async () => {
      const html = '<html><head><link rel="canonical" href="https://example.com/page/"><link rel="canonical" href="https://example.com/page"></head></html>';
      const context = createContext(html);
      const result = await canonicalMultipleRule.run(context);
      expect(result.status).toBe('warn');
      expect(result.details?.match).toBe(true);
    });
  });

  describe('robotsDirectiveMismatchRule', () => {
    it('should pass when neither meta robots nor X-Robots-Tag exists', async () => {
      const html = '<html><head></head><body></body></html>';
      const context = createContext(html);
      const result = await robotsDirectiveMismatchRule.run(context);
      expect(result.status).toBe('pass');
      expect(result.message).toContain('No robots directives declared');
    });

    it('should pass when only the HTML declares noindex', async () => {
      const html = '<html><head><meta name="robots" content="noindex"></head></html>';
      const context = createContext(html);
      const result = await robotsDirectiveMismatchRule.run(context);
      expect(result.status).toBe('pass');
    });

    it('should pass when only the header declares noindex', async () => {
      const html = '<html><head></head></html>';
      const headers = { 'x-robots-tag': 'noindex' };
      const context = createContext(html, headers);
      const result = await robotsDirectiveMismatchRule.run(context);
      expect(result.status).toBe('pass');
    });

    it('should fail when HTML declares noindex but the header declares index', async () => {
      const html = '<html><head><meta name="robots" content="noindex,nofollow"></head></html>';
      const headers = { 'x-robots-tag': 'index,nofollow' };
      const context = createContext(html, headers);
      const result = await robotsDirectiveMismatchRule.run(context);
      expect(result.status).toBe('fail');
      expect(result.details?.mismatches).toContain('noindex');
    });

    it('should fail when HTML declares index but the header declares noindex', async () => {
      const html = '<html><head><meta name="robots" content="index,follow"></head></html>';
      const headers = { 'x-robots-tag': 'noindex' };
      const context = createContext(html, headers);
      const result = await robotsDirectiveMismatchRule.run(context);
      expect(result.status).toBe('fail');
      expect(result.details?.mismatches).toContain('noindex');
    });

    it('should fail when HTML declares follow but the header declares nofollow', async () => {
      const html = '<html><head><meta name="robots" content="index,follow"></head></html>';
      const headers = { 'x-robots-tag': 'index,nofollow' };
      const context = createContext(html, headers);
      const result = await robotsDirectiveMismatchRule.run(context);
      expect(result.status).toBe('fail');
      expect(result.details?.mismatches).toContain('nofollow');
    });

    it('should warn when noindex is declared in both HTML and the header', async () => {
      const html = '<html><head><meta name="robots" content="noindex"></head></html>';
      const headers = { 'x-robots-tag': 'noindex' };
      const context = createContext(html, headers);
      const result = await robotsDirectiveMismatchRule.run(context);
      expect(result.status).toBe('warn');
      expect(result.message).toContain('noindex declared in 2 locations');
    });

    it('should warn when nofollow is declared in both HTML and the header', async () => {
      const html = '<html><head><meta name="robots" content="nofollow"></head></html>';
      const headers = { 'x-robots-tag': 'nofollow' };
      const context = createContext(html, headers);
      const result = await robotsDirectiveMismatchRule.run(context);
      expect(result.status).toBe('warn');
      expect(result.message).toContain('nofollow declared in 2 locations');
    });

    it('should warn when multiple meta robots tags declare noindex', async () => {
      const html = '<html><head><meta name="robots" content="noindex,nofollow"><meta name="robots" content="noindex,follow"></head></html>';
      const context = createContext(html);
      const result = await robotsDirectiveMismatchRule.run(context);
      expect(result.status).toBe('warn');
      expect(result.message).toContain('noindex declared in 2 locations');
    });

    it('should ignore bot-prefixed header segments when comparing', async () => {
      const html = '<html><head><meta name="robots" content="index,follow"></head></html>';
      const headers = { 'x-robots-tag': 'googlebot: noindex' };
      const context = createContext(html, headers);
      const result = await robotsDirectiveMismatchRule.run(context);
      expect(result.status).toBe('pass');
    });
  });

  describe('canonicalExternalRule', () => {
    it('should surface a canonical pointing to a different host', async () => {
      const html = '<html><head><link rel="canonical" href="https://cdn.example.net/syndicated-post"></head></html>';
      const context = createContext(html, {}, 'https://example.com/blog/post');
      const result = await canonicalExternalRule.run(context);
      expect(result.status).toBe('pass');
      expect(result.details?.external).toBe(true);
      expect(result.details?.canonicalHost).toBe('cdn.example.net');
      expect(result.details?.pageHost).toBe('example.com');
      expect(result.message).toContain('cdn.example.net');
    });

    it('should pass quietly when the canonical is on the same host', async () => {
      const html = '<html><head><link rel="canonical" href="https://example.com/blog/post"></head></html>';
      const context = createContext(html, {}, 'https://example.com/blog/post?utm=1');
      const result = await canonicalExternalRule.run(context);
      expect(result.status).toBe('pass');
      expect(result.details?.external).toBe(false);
    });

    it('should pass when no canonical tag is declared', async () => {
      const context = createContext('<html><head></head></html>');
      const result = await canonicalExternalRule.run(context);
      expect(result.status).toBe('pass');
      expect(result.details?.found).toBe(false);
    });

    it('should pass when the canonical URL cannot be parsed', async () => {
      const html = '<html><head><link rel="canonical" href="http://[bad"></head></html>';
      const context = createContext(html);
      const result = await canonicalExternalRule.run(context);
      expect(result.status).toBe('pass');
      expect(result.details?.found).toBe(true);
    });

    it('should resolve a relative canonical against the page URL', async () => {
      const html = '<html><head><link rel="canonical" href="/blog/post"></head></html>';
      const context = createContext(html, {}, 'https://example.com/blog/post');
      const result = await canonicalExternalRule.run(context);
      expect(result.status).toBe('pass');
      expect(result.details?.external).toBe(false);
      expect(result.details?.canonicalUrl).toBe('https://example.com/blog/post');
    });
  });
});
