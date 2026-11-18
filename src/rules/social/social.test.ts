import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import * as cheerio from 'cheerio';
import type { AuditContext } from '../../types.js';
import { ogImageSizeRule } from './og-image-size.js';
import { ogUrlCanonicalRule } from './og-url-canonical.js';
import { shareButtonsRule } from './share-buttons.js';
import { socialProfilesRule } from './social-profiles.js';
import { createTestContext } from '../test-context.js';
import { png } from './image-fixtures.js';

/**
 * Helper to create an audit context from HTML
 */
function createContext(html: string, url = 'https://example.com'): AuditContext {
  return createTestContext(html, { url });
}

describe('Social Rules', () => {
  describe('social-og-image-size', () => {
    const IMAGE = 'https://example.com/image.png';
    const head = (dims = '') => `<html><head><meta property="og:image" content="${IMAGE}">${dims}</head></html>`;
    const declared = (w: string, h: string) => `<meta property="og:image:width" content="${w}"><meta property="og:image:height" content="${h}">`;
    const serveImage = (bytes: Uint8Array<ArrayBuffer>, status = 200) =>
      vi.stubGlobal('fetch', vi.fn(async () => new Response(bytes, { status, headers: { 'content-type': 'image/png' } })));
    afterEach(() => vi.unstubAllGlobals());

    it('is not measured without an og:image, or without declared dimensions', async () => {
      expect((await ogImageSizeRule.run(createContext('<html><head></head></html>'))).status).toBe('not-measured');
      expect((await ogImageSizeRule.run(createContext(head()))).status).toBe('not-measured');
    });

    it('passes when the declared size is the real size', async () => {
      serveImage(png(1200, 630));
      const result = await ogImageSizeRule.run(createContext(head(declared('1200', '630'))));
      expect(result.status).toBe('pass');
      expect(result.details?.actual).toEqual({ width: 1200, height: 630 });
    });

    it('warns when the declared size is not the real size', async () => {
      serveImage(png(600, 315));
      const result = await ogImageSizeRule.run(createContext(head(declared('1200', '630'))));
      expect(result.status).toBe('warn');
      expect(result.message).toContain('declares 1200×630 but the image is 600×315');
    });

    it('warns when the declared values are not whole pixel counts', async () => {
      const result = await ogImageSizeRule.run(createContext(head(declared('wide', '630'))));
      expect(result.status).toBe('warn');
    });

    it('is not measured when the image cannot be read', async () => {
      serveImage(new Uint8Array(0), 404);
      const result = await ogImageSizeRule.run(createContext(head(declared('1200', '630'))));
      expect(result.status).toBe('not-measured');
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
      expect(result.details?.match).toBe(true);
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
      expect(result.details?.match).toBe(false);
    });

    it('should fail when og:url is missing but canonical exists', async () => {
      const context = createContext(`
        <html><head>
          <link rel="canonical" href="https://example.com/page">
        </head></html>
      `);
      const result = await ogUrlCanonicalRule.run(context);
      expect(result.status).toBe('fail');
      expect(result.details?.hasOgUrl).toBe(false);
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
      expect(result.details?.platformCount).toBeGreaterThanOrEqual(2);
    });

    it('should pass when share widget is detected', async () => {
      const context = createContext(`
        <html><body>
          <div class="addthis_toolbox">Share buttons here</div>
        </body></html>
      `);
      const result = await shareButtonsRule.run(context);
      expect(result.status).toBe('pass');
      expect(result.details?.hasShareContainer).toBe(true);
    });

    it('should warn when only one platform detected', async () => {
      const context = createContext(`
        <html><body>
          <a href="https://www.facebook.com/sharer/sharer.php?u=test">Share on Facebook</a>
        </body></html>
      `);
      const result = await shareButtonsRule.run(context);
      expect(result.status).toBe('warn');
      expect(result.details?.limitedPlatforms).toBe(true);
    });

    it('should warn when no share buttons found', async () => {
      const context = createContext('<html><body><p>No share buttons here</p></body></html>');
      const result = await shareButtonsRule.run(context);
      expect(result.status).toBe('warn');
      expect(result.details?.hasShareButtons).toBe(false);
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
      expect(result.details?.platforms).toContain('WhatsApp');
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
      expect(result.details?.profileCount).toBeGreaterThanOrEqual(3);
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
      expect(result.details?.profileCount).toBeGreaterThanOrEqual(3);
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
      expect(result.details?.profileCount).toBe(1);
    });

    it('should warn when no profiles found', async () => {
      const context = createContext('<html><body><p>No social links</p></body></html>');
      const result = await socialProfilesRule.run(context);
      expect(result.status).toBe('warn');
      expect(result.details?.hasProfiles).toBe(false);
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
      expect(result.details?.hasProfiles).toBe(false);
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
      const platforms = (result.details?.profiles as { platform: string }[]).map((p) => p.platform);
      expect(platforms).toContain('GitHub');
    });
  });
});
