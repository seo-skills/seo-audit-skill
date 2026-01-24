import { describe, it, expect } from 'vitest';
import { fontSizeRule } from './font-size.js';
import { horizontalScrollRule } from './horizontal-scroll.js';
import { interstitialsRule } from './interstitials.js';
import type { AuditContext } from '../../types.js';
import * as cheerio from 'cheerio';

// Helper to create AuditContext
function createContext(html: string, url = 'https://example.com/'): AuditContext {
  return {
    url,
    html,
    $: cheerio.load(html),
    headers: {},
    links: [],
    images: [],
    statusCode: 200,
    responseTime: 100,
    redirectChain: [],
  };
}

describe('fontSizeRule', () => {
  it('should pass for normal font sizes', async () => {
    const html = `
      <html>
        <body>
          <p style="font-size: 16px">Normal text</p>
          <p style="font-size: 1rem">Also normal</p>
        </body>
      </html>
    `;
    const context = createContext(html);
    const result = await fontSizeRule.run(context);
    expect(result.status).toBe('pass');
  });

  it('should fail for font sizes below 12px', async () => {
    const html = `
      <html>
        <body>
          <p style="font-size: 10px">Too small</p>
        </body>
      </html>
    `;
    const context = createContext(html);
    const result = await fontSizeRule.run(context);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('critical');
  });

  it('should warn for font sizes between 12-16px', async () => {
    const html = `
      <html>
        <body>
          <p style="font-size: 14px">Slightly small</p>
        </body>
      </html>
    `;
    const context = createContext(html);
    const result = await fontSizeRule.run(context);
    expect(result.status).toBe('warn');
  });

  it('should detect small fonts in CSS', async () => {
    const html = `
      <html>
        <head>
          <style>
            .tiny { font-size: 8px; }
          </style>
        </head>
        <body><p class="tiny">Tiny</p></body>
      </html>
    `;
    const context = createContext(html);
    const result = await fontSizeRule.run(context);
    expect(result.status).toBe('fail');
  });

  it('should detect tight line-height', async () => {
    const html = `
      <html>
        <body>
          <p style="line-height: 1.0">Tight spacing</p>
        </body>
      </html>
    `;
    const context = createContext(html);
    const result = await fontSizeRule.run(context);
    expect(result.status).toBe('warn');
    expect(result.details?.tightLineHeightCount).toBeGreaterThan(0);
  });

  it('should handle rem units correctly', async () => {
    const html = `
      <html>
        <body>
          <p style="font-size: 0.5rem">Half rem = 8px</p>
        </body>
      </html>
    `;
    const context = createContext(html);
    const result = await fontSizeRule.run(context);
    expect(result.status).toBe('fail');
  });
});

describe('horizontalScrollRule', () => {
  it('should pass for responsive layouts', async () => {
    const html = `
      <html>
        <body>
          <img src="test.jpg" style="max-width: 100%">
          <div style="width: 100%">Content</div>
        </body>
      </html>
    `;
    const context = createContext(html);
    const result = await horizontalScrollRule.run(context);
    expect(result.status).toBe('pass');
  });

  it('should warn for fixed width elements exceeding mobile viewport', async () => {
    const html = `
      <html>
        <body>
          <div style="width: 800px">Too wide</div>
        </body>
      </html>
    `;
    const context = createContext(html);
    const result = await horizontalScrollRule.run(context);
    expect(result.status).toBe('warn');
  });

  it('should detect large images without responsive constraints', async () => {
    const html = `
      <html>
        <body>
          <img src="big.jpg" width="1200">
        </body>
      </html>
    `;
    const context = createContext(html);
    const result = await horizontalScrollRule.run(context);
    expect(result.status).toBe('warn');
  });

  it('should detect fixed width iframes', async () => {
    const html = `
      <html>
        <body>
          <iframe src="https://youtube.com" width="800"></iframe>
        </body>
      </html>
    `;
    const context = createContext(html);
    const result = await horizontalScrollRule.run(context);
    expect(result.status).toBe('warn');
  });

  it('should warn about 100vw usage', async () => {
    const html = `
      <html>
        <body>
          <div style="width: 100vw">May cause scroll</div>
        </body>
      </html>
    `;
    const context = createContext(html);
    const result = await horizontalScrollRule.run(context);
    expect(result.status).toBe('warn');
    expect(result.details?.issues[0].issue).toContain('100vw');
  });

  it('should fail for multiple critical issues', async () => {
    const html = `
      <html>
        <body>
          <img src="a.jpg" width="800">
          <img src="b.jpg" width="900">
          <img src="c.jpg" width="1000">
          <iframe src="https://x.com" width="600"></iframe>
        </body>
      </html>
    `;
    const context = createContext(html);
    const result = await horizontalScrollRule.run(context);
    expect(result.status).toBe('fail');
  });
});

describe('interstitialsRule', () => {
  it('should pass for pages without popups', async () => {
    const html = `
      <html>
        <body>
          <header>Header</header>
          <main>Content</main>
          <footer>Footer</footer>
        </body>
      </html>
    `;
    const context = createContext(html);
    const result = await interstitialsRule.run(context);
    expect(result.status).toBe('pass');
  });

  it('should detect modal overlays', async () => {
    const html = `
      <html>
        <body>
          <div class="modal-overlay" style="position: fixed; z-index: 9999">
            <div class="modal-content">Subscribe!</div>
          </div>
          <main>Content</main>
        </body>
      </html>
    `;
    const context = createContext(html);
    const result = await interstitialsRule.run(context);
    expect(result.status).toBe('warn');
    expect(result.details?.issues[0].type).toContain('Popup');
  });

  it('should detect newsletter popup forms', async () => {
    const html = `
      <html>
        <body>
          <div class="popup">
            <form action="https://mailchimp.com/subscribe">
              <input type="email">
              <button>Subscribe</button>
            </form>
          </div>
          <main>Content</main>
        </body>
      </html>
    `;
    const context = createContext(html);
    const result = await interstitialsRule.run(context);
    expect(result.status).toBe('warn');
  });

  it('should not flag cookie consent banners', async () => {
    const html = `
      <html>
        <body>
          <div class="cookie-consent" style="position: fixed; bottom: 0">
            Accept cookies?
          </div>
          <main>Content</main>
        </body>
      </html>
    `;
    const context = createContext(html);
    const result = await interstitialsRule.run(context);
    expect(result.status).toBe('pass');
  });

  it('should not flag GDPR consent', async () => {
    const html = `
      <html>
        <body>
          <div id="gdpr-modal" class="overlay" style="position: fixed">
            Privacy settings
          </div>
          <main>Content</main>
        </body>
      </html>
    `;
    const context = createContext(html);
    const result = await interstitialsRule.run(context);
    expect(result.status).toBe('pass');
  });

  it('should detect exit-intent scripts', async () => {
    const html = `
      <html>
        <head>
          <script>
            document.addEventListener('mouseout', function(e) {
              if (e.clientY < 0) {
                showExitIntentPopup();
              }
            });
          </script>
        </head>
        <body><main>Content</main></body>
      </html>
    `;
    const context = createContext(html);
    const result = await interstitialsRule.run(context);
    expect(result.status).toBe('fail');
    expect(result.details?.issues[0].type).toContain('Exit-intent');
  });

  it('should detect splash screens', async () => {
    const html = `
      <html>
        <body>
          <div id="splash-screen" style="position: fixed; z-index: 9999">
            Loading...
          </div>
          <main>Content</main>
        </body>
      </html>
    `;
    const context = createContext(html);
    const result = await interstitialsRule.run(context);
    expect(result.status).toBe('warn');
  });

  it('should detect full-screen fixed elements', async () => {
    const html = `
      <html>
        <body>
          <div style="position: fixed; top: 0; height: 100vh">
            Welcome!
          </div>
          <main>Content</main>
        </body>
      </html>
    `;
    const context = createContext(html);
    const result = await interstitialsRule.run(context);
    expect(result.status).toBe('fail');
  });
});
