import { describe, it, expect } from 'vitest';
import { cookieConsentRule } from './cookie-consent.js';
import { privacyPolicyRule } from './privacy-policy.js';
import { termsOfServiceRule } from './terms-of-service.js';
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

describe('cookieConsentRule', () => {
  it('should pass when cookie consent banner is present', async () => {
    const html = `
      <html>
        <body>
          <div class="cookie-consent-banner">
            <p>We use cookies</p>
            <button>Accept</button>
          </div>
          <main>Content</main>
        </body>
      </html>
    `;
    const context = createContext(html);
    const result = await cookieConsentRule.run(context);
    expect(result.status).toBe('pass');
    expect(result.details?.hasConsent).toBe(true);
  });

  it('should detect OneTrust consent platform', async () => {
    const html = `
      <html>
        <head>
          <script src="https://cdn.onetrust.com/consent.js"></script>
        </head>
        <body><main>Content</main></body>
      </html>
    `;
    const context = createContext(html);
    const result = await cookieConsentRule.run(context);
    expect(result.status).toBe('pass');
    expect(result.details?.detected).toContain('Script: onetrust.com');
  });

  it('should detect CookieYes consent platform', async () => {
    const html = `
      <html>
        <head>
          <script src="https://cdn.cookieyes.com/client_data/abc123.js"></script>
        </head>
        <body><main>Content</main></body>
      </html>
    `;
    const context = createContext(html);
    const result = await cookieConsentRule.run(context);
    expect(result.status).toBe('pass');
    expect(result.details?.detected).toContain('Script: cookieyes.com');
  });

  it('should detect Cookiebot consent platform', async () => {
    const html = `
      <html>
        <body>
          <div id="cookiebot-banner">Accept cookies?</div>
          <main>Content</main>
        </body>
      </html>
    `;
    const context = createContext(html);
    const result = await cookieConsentRule.run(context);
    expect(result.status).toBe('pass');
    expect(result.details?.hasConsent).toBe(true);
  });

  it('should detect consent buttons', async () => {
    const html = `
      <html>
        <body>
          <div class="overlay">
            <button>Accept Cookies</button>
            <button>Manage Cookie Preferences</button>
          </div>
          <main>Content</main>
        </body>
      </html>
    `;
    const context = createContext(html);
    const result = await cookieConsentRule.run(context);
    expect(result.status).toBe('pass');
    expect(result.details?.hasConsent).toBe(true);
  });

  it('should warn when tracking present but no consent mechanism', async () => {
    const html = `
      <html>
        <head>
          <script src="https://www.googletagmanager.com/gtag/js"></script>
        </head>
        <body><main>Content</main></body>
      </html>
    `;
    const context = createContext(html);
    const result = await cookieConsentRule.run(context);
    expect(result.status).toBe('warn');
    expect(result.details?.hasTracking).toBe(true);
  });

  it('should pass when no tracking and no consent (not required)', async () => {
    const html = `
      <html>
        <body><main>Just content, no tracking</main></body>
      </html>
    `;
    const context = createContext(html);
    const result = await cookieConsentRule.run(context);
    expect(result.status).toBe('pass');
    expect(result.details?.hasConsent).toBe(false);
    expect(result.details?.hasTracking).toBe(false);
  });

  it('should detect GDPR consent elements', async () => {
    const html = `
      <html>
        <body>
          <div id="gdpr-consent-modal">
            <p>GDPR consent required</p>
            <button>Accept All</button>
          </div>
          <main>Content</main>
        </body>
      </html>
    `;
    const context = createContext(html);
    const result = await cookieConsentRule.run(context);
    expect(result.status).toBe('pass');
    expect(result.details?.hasConsent).toBe(true);
  });
});

describe('privacyPolicyRule', () => {
  it('should pass when privacy policy link in footer', async () => {
    const html = `
      <html>
        <body>
          <main>Content</main>
          <footer>
            <a href="/privacy-policy">Privacy Policy</a>
          </footer>
        </body>
      </html>
    `;
    const context = createContext(html);
    const result = await privacyPolicyRule.run(context);
    expect(result.status).toBe('pass');
    expect(result.details?.inFooter).toBe(true);
  });

  it('should detect privacy policy by link text', async () => {
    const html = `
      <html>
        <body>
          <main>Content</main>
          <a href="/legal/privacy">Privacy Notice</a>
        </body>
      </html>
    `;
    const context = createContext(html);
    const result = await privacyPolicyRule.run(context);
    expect(result.status).toBe('pass');
    expect(result.details?.hasPrivacyPolicy).toBe(true);
  });

  it('should detect privacy policy by URL path', async () => {
    const html = `
      <html>
        <body>
          <main>Content</main>
          <a href="https://example.com/privacy">Legal stuff</a>
        </body>
      </html>
    `;
    const context = createContext(html);
    const result = await privacyPolicyRule.run(context);
    expect(result.status).toBe('pass');
    expect(result.details?.hasPrivacyPolicy).toBe(true);
  });

  it('should detect German privacy policy (Datenschutz)', async () => {
    const html = `
      <html>
        <body>
          <main>Content</main>
          <footer>
            <a href="/datenschutz">Datenschutz</a>
          </footer>
        </body>
      </html>
    `;
    const context = createContext(html);
    const result = await privacyPolicyRule.run(context);
    expect(result.status).toBe('pass');
    expect(result.details?.hasPrivacyPolicy).toBe(true);
  });

  it('should warn when no privacy policy link found', async () => {
    const html = `
      <html>
        <body>
          <main>Content</main>
          <footer>
            <a href="/about">About</a>
            <a href="/contact">Contact</a>
          </footer>
        </body>
      </html>
    `;
    const context = createContext(html);
    const result = await privacyPolicyRule.run(context);
    expect(result.status).toBe('warn');
    expect(result.details?.hasPrivacyPolicy).toBe(false);
  });

  it('should detect privacy policy by aria-label', async () => {
    const html = `
      <html>
        <body>
          <main>Content</main>
          <a href="/legal" aria-label="Privacy Policy">Legal</a>
        </body>
      </html>
    `;
    const context = createContext(html);
    const result = await privacyPolicyRule.run(context);
    expect(result.status).toBe('pass');
    expect(result.details?.hasPrivacyPolicy).toBe(true);
  });
});

describe('termsOfServiceRule', () => {
  it('should pass when terms of service link in footer', async () => {
    const html = `
      <html>
        <body>
          <main>Content</main>
          <footer>
            <a href="/terms-of-service">Terms of Service</a>
          </footer>
        </body>
      </html>
    `;
    const context = createContext(html);
    const result = await termsOfServiceRule.run(context);
    expect(result.status).toBe('pass');
    expect(result.details?.inFooter).toBe(true);
  });

  it('should detect terms by link text variations', async () => {
    const html = `
      <html>
        <body>
          <main>Content</main>
          <a href="/legal">Terms & Conditions</a>
        </body>
      </html>
    `;
    const context = createContext(html);
    const result = await termsOfServiceRule.run(context);
    expect(result.status).toBe('pass');
    expect(result.details?.hasTermsOfService).toBe(true);
  });

  it('should detect terms by URL path (/tos)', async () => {
    const html = `
      <html>
        <body>
          <main>Content</main>
          <a href="/tos">Legal</a>
        </body>
      </html>
    `;
    const context = createContext(html);
    const result = await termsOfServiceRule.run(context);
    expect(result.status).toBe('pass');
    expect(result.details?.hasTermsOfService).toBe(true);
  });

  it('should detect user agreement link', async () => {
    const html = `
      <html>
        <body>
          <main>Content</main>
          <a href="/user-agreement">User Agreement</a>
        </body>
      </html>
    `;
    const context = createContext(html);
    const result = await termsOfServiceRule.run(context);
    expect(result.status).toBe('pass');
    expect(result.details?.hasTermsOfService).toBe(true);
  });

  it('should warn for e-commerce site without ToS', async () => {
    const html = `
      <html>
        <body>
          <main>
            <button class="add-to-cart">Add to Cart</button>
            <div class="product-price">$99.99</div>
          </main>
        </body>
      </html>
    `;
    const context = createContext(html);
    const result = await termsOfServiceRule.run(context);
    expect(result.status).toBe('warn');
    expect(result.details?.siteType).toBe('e-commerce');
  });

  it('should warn for SaaS site without ToS', async () => {
    const html = `
      <html>
        <body>
          <main>
            <form action="/signup">
              <input type="email" placeholder="Email">
              <button>Sign Up</button>
            </form>
          </main>
        </body>
      </html>
    `;
    const context = createContext(html);
    const result = await termsOfServiceRule.run(context);
    expect(result.status).toBe('warn');
    expect(result.details?.siteType).toBe('SaaS/membership');
  });

  it('should pass for simple blog without ToS (not required)', async () => {
    const html = `
      <html>
        <body>
          <main>
            <article>
              <h1>Blog Post</h1>
              <p>Some content here...</p>
            </article>
          </main>
        </body>
      </html>
    `;
    const context = createContext(html);
    const result = await termsOfServiceRule.run(context);
    expect(result.status).toBe('pass');
    expect(result.details?.hasTermsOfService).toBe(false);
  });

  it('should detect German terms (Nutzungsbedingungen)', async () => {
    const html = `
      <html>
        <body>
          <main>Content</main>
          <footer>
            <a href="/nutzungsbedingungen">Nutzungsbedingungen</a>
          </footer>
        </body>
      </html>
    `;
    const context = createContext(html);
    const result = await termsOfServiceRule.run(context);
    expect(result.status).toBe('pass');
    expect(result.details?.hasTermsOfService).toBe(true);
  });
});
