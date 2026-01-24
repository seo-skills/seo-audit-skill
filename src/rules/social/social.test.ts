import { describe, it, expect, beforeAll } from 'vitest';
import * as cheerio from 'cheerio';
import type { AuditContext } from '../../types.js';
import { ogImageSizeRule } from './og-image-size.js';
import { ogUrlCanonicalRule } from './og-url-canonical.js';
import { shareButtonsRule } from './share-buttons.js';
import { socialProfilesRule } from './social-profiles.js';

/**
 * Helper to create an audit context from HTML
 */
function createContext(html: string, url = 'https://example.com'): AuditContext {
  const $ = cheerio.load(html);
  return {
    url,
    html,
    $,
    headers: {},
    statusCode: 200,
    links: [],
    images: [],
    externalLinkResults: new Map(),
  };
}

describe('Social Rules', () => {
  describe('social-og-image-size', () => {
    it('should fail when og:image is missing', async () => {
      const context = createContext('<html><head></head></html>');
      const result = await ogImageSizeRule.run(context);
      expect(result.status).toBe('fail');
      expect(result.details.hasImage).toBe(false);
    });

    it('should warn when og:image exists but no dimensions', async () => {
      const context = createContext(`
        <html><head>
          <meta property="og:image" content="https://example.com/image.jpg">
        </head></html>
      `);
      const result = await ogImageSizeRule.run(context);
      expect(result.status).toBe('warn');
      expect(result.details.hasDimensions).toBe(false);
    });

    it('should pass when dimensions are optimal (1200x630)', async () => {
      const context = createContext(`
        <html><head>
          <meta property="og:image" content="https://example.com/image.jpg">
          <meta property="og:image:width" content="1200">
          <meta property="og:image:height" content="630">
        </head></html>
      `);
      const result = await ogImageSizeRule.run(context);
      expect(result.status).toBe('pass');
      expect(result.details.optimal).toBe(true);
    });

    it('should warn when dimensions are below recommended', async () => {
      const context = createContext(`
        <html><head>
          <meta property="og:image" content="https://example.com/image.jpg">
          <meta property="og:image:width" content="600">
          <meta property="og:image:height" content="315">
        </head></html>
      `);
      const result = await ogImageSizeRule.run(context);
      expect(result.status).toBe('warn');
      expect(result.details.belowRecommended).toBe(true);
    });

    it('should fail when dimensions are too small', async () => {
      const context = createContext(`
        <html><head>
          <meta property="og:image" content="https://example.com/image.jpg">
          <meta property="og:image:width" content="100">
          <meta property="og:image:height" content="100">
        </head></html>
      `);
      const result = await ogImageSizeRule.run(context);
      expect(result.status).toBe('fail');
      expect(result.details.tooSmall).toBe(true);
    });
  });

  describe('social-og-url-canonical', () => {
    it('should pass when og:url matches canonical', async () => {
      const context = createContext(`
        <html><head>
          <meta property="og:url" content="https://example.com/page">
          <link rel="canonical" href="https://example.com/page">
        </head></html>
      `);
      const result = await ogUrlCanonicalRule.run(context);
      expect(result.status).toBe('pass');
      expect(result.details.match).toBe(true);
    });

    it('should pass when URLs match with trailing slash normalization', async () => {
      const context = createContext(`
        <html><head>
          <meta property="og:url" content="https://example.com/page/">
          <link rel="canonical" href="https://example.com/page">
        </head></html>
      `);
      const result = await ogUrlCanonicalRule.run(context);
      expect(result.status).toBe('pass');
    });

    it('should fail when og:url differs from canonical', async () => {
      const context = createContext(`
        <html><head>
          <meta property="og:url" content="https://example.com/wrong-page">
          <link rel="canonical" href="https://example.com/page">
        </head></html>
      `);
      const result = await ogUrlCanonicalRule.run(context);
      expect(result.status).toBe('fail');
      expect(result.details.match).toBe(false);
    });

    it('should fail when og:url is missing but canonical exists', async () => {
      const context = createContext(`
        <html><head>
          <link rel="canonical" href="https://example.com/page">
        </head></html>
      `);
      const result = await ogUrlCanonicalRule.run(context);
      expect(result.status).toBe('fail');
      expect(result.details.hasOgUrl).toBe(false);
    });

    it('should warn when neither og:url nor canonical exists', async () => {
      const context = createContext('<html><head></head></html>');
      const result = await ogUrlCanonicalRule.run(context);
      expect(result.status).toBe('warn');
    });
  });

  describe('social-share-buttons', () => {
    it('should pass when multiple share platforms detected', async () => {
      const context = createContext(`
        <html><body>
          <a href="https://www.facebook.com/sharer/sharer.php?u=test">Share on Facebook</a>
          <a href="https://twitter.com/intent/tweet?url=test">Share on Twitter</a>
          <a href="https://www.linkedin.com/shareArticle?url=test">Share on LinkedIn</a>
        </body></html>
      `);
      const result = await shareButtonsRule.run(context);
      expect(result.status).toBe('pass');
      expect(result.details.platformCount).toBeGreaterThanOrEqual(2);
    });

    it('should pass when share widget is detected', async () => {
      const context = createContext(`
        <html><body>
          <div class="addthis_toolbox">Share buttons here</div>
        </body></html>
      `);
      const result = await shareButtonsRule.run(context);
      expect(result.status).toBe('pass');
      expect(result.details.hasShareContainer).toBe(true);
    });

    it('should warn when only one platform detected', async () => {
      const context = createContext(`
        <html><body>
          <a href="https://www.facebook.com/sharer/sharer.php?u=test">Share on Facebook</a>
        </body></html>
      `);
      const result = await shareButtonsRule.run(context);
      expect(result.status).toBe('warn');
      expect(result.details.limitedPlatforms).toBe(true);
    });

    it('should warn when no share buttons found', async () => {
      const context = createContext('<html><body><p>No share buttons here</p></body></html>');
      const result = await shareButtonsRule.run(context);
      expect(result.status).toBe('warn');
      expect(result.details.hasShareButtons).toBe(false);
    });

    it('should detect WhatsApp share links', async () => {
      const context = createContext(`
        <html><body>
          <a href="https://wa.me/?text=Check+this+out">WhatsApp</a>
          <a href="https://www.facebook.com/sharer/sharer.php?u=test">Facebook</a>
        </body></html>
      `);
      const result = await shareButtonsRule.run(context);
      expect(result.status).toBe('pass');
      expect(result.details.platforms).toContain('WhatsApp');
    });
  });

  describe('social-profiles', () => {
    it('should pass when 3+ social profiles found', async () => {
      const context = createContext(`
        <html><body>
          <footer>
            <a href="https://facebook.com/company">Facebook</a>
            <a href="https://twitter.com/company">Twitter</a>
            <a href="https://instagram.com/company">Instagram</a>
            <a href="https://linkedin.com/company/mycompany">LinkedIn</a>
          </footer>
        </body></html>
      `);
      const result = await socialProfilesRule.run(context);
      expect(result.status).toBe('pass');
      expect(result.details.profileCount).toBeGreaterThanOrEqual(3);
    });

    it('should detect sameAs in structured data', async () => {
      const context = createContext(`
        <html><head>
          <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": "Organization",
              "name": "Example",
              "sameAs": [
                "https://facebook.com/example",
                "https://twitter.com/example",
                "https://instagram.com/example"
              ]
            }
          </script>
        </head></html>
      `);
      const result = await socialProfilesRule.run(context);
      expect(result.status).toBe('pass');
      expect(result.details.profileCount).toBeGreaterThanOrEqual(3);
    });

    it('should warn when only 1-2 profiles found', async () => {
      const context = createContext(`
        <html><body>
          <footer>
            <a href="https://facebook.com/company">Facebook</a>
          </footer>
        </body></html>
      `);
      const result = await socialProfilesRule.run(context);
      expect(result.status).toBe('warn');
      expect(result.details.profileCount).toBe(1);
    });

    it('should warn when no profiles found', async () => {
      const context = createContext('<html><body><p>No social links</p></body></html>');
      const result = await socialProfilesRule.run(context);
      expect(result.status).toBe('warn');
      expect(result.details.hasProfiles).toBe(false);
    });

    it('should not count share links as profiles', async () => {
      const context = createContext(`
        <html><body>
          <a href="https://facebook.com/sharer/sharer.php?u=test">Share</a>
          <a href="https://twitter.com/intent/tweet?url=test">Tweet</a>
        </body></html>
      `);
      const result = await socialProfilesRule.run(context);
      expect(result.status).toBe('warn');
      expect(result.details.hasProfiles).toBe(false);
    });

    it('should detect GitHub profiles', async () => {
      const context = createContext(`
        <html><body>
          <footer class="social">
            <a href="https://github.com/company">GitHub</a>
            <a href="https://twitter.com/company">Twitter</a>
            <a href="https://linkedin.com/company/mycompany">LinkedIn</a>
          </footer>
        </body></html>
      `);
      const result = await socialProfilesRule.run(context);
      expect(result.status).toBe('pass');
      const platforms = result.details.profiles.map((p: { platform: string }) => p.platform);
      expect(platforms).toContain('GitHub');
    });
  });
});
