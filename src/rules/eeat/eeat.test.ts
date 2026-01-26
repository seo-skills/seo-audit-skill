import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as cheerio from 'cheerio';
import type { AuditContext } from '../../types.js';
import { clearRegistry } from '../registry.js';

// Import rules
import { aboutPageRule } from './about-page.js';
import { affiliateDisclosureRule } from './affiliate-disclosure.js';
import { authorBylineRule } from './author-byline.js';
import { authorExpertiseRule } from './author-expertise.js';
import { citationsRule } from './citations.js';
import { contactPageRule } from './contact-page.js';
import { contentDatesRule } from './content-dates.js';
import { disclaimersRule } from './disclaimers.js';
import { editorialPolicyRule } from './editorial-policy.js';
import { physicalAddressRule } from './physical-address.js';
import { privacyPolicyRule } from './privacy-policy.js';
import { termsOfServiceRule } from './terms-of-service.js';
import { trustSignalsRule } from './trust-signals.js';
import { ymylDetectionRule, detectYMYL } from './ymyl-detection.js';

// Helper to create test context
function createContext(html: string, url = 'https://example.com'): AuditContext {
  return {
    url,
    html,
    $: cheerio.load(html),
    headers: {},
    statusCode: 200,
  };
}

describe('E-E-A-T Rules', () => {
  beforeEach(() => {
    clearRegistry();
  });

  afterEach(() => {
    clearRegistry();
  });

  describe('eeat-about-page', () => {
    it('should pass when about link is in navigation', async () => {
      const html = `
        <html><body>
          <nav><a href="/about">About Us</a></nav>
          <main>Content</main>
        </body></html>
      `;
      const result = await aboutPageRule.run(createContext(html));
      expect(result.status).toBe('pass');
      expect(result.details?.hasAboutPage).toBe(true);
    });

    it('should pass when about URL is found', async () => {
      const html = `
        <html><body>
          <footer><a href="/about-us">Company</a></footer>
        </body></html>
      `;
      const result = await aboutPageRule.run(createContext(html));
      expect(result.status).toBe('pass');
    });

    it('should warn when no about page link found', async () => {
      const html = `<html><body><main>No about link</main></body></html>`;
      const result = await aboutPageRule.run(createContext(html));
      expect(result.status).toBe('warn');
      expect(result.details?.hasAboutPage).toBe(false);
    });
  });

  describe('eeat-affiliate-disclosure', () => {
    it('should pass when no affiliate links present', async () => {
      const html = `
        <html><body>
          <a href="https://example.com/page">Regular link</a>
        </body></html>
      `;
      const result = await affiliateDisclosureRule.run(createContext(html));
      expect(result.status).toBe('pass');
      expect(result.details?.hasAffiliateLinks).toBe(false);
    });

    it('should pass when affiliate link has disclosure', async () => {
      const html = `
        <html><body>
          <div class="disclosure">This post contains affiliate links. We may earn a commission.</div>
          <a href="https://amazon.com/product?tag=mysite-20">Product</a>
        </body></html>
      `;
      const result = await affiliateDisclosureRule.run(createContext(html));
      expect(result.status).toBe('pass');
      expect(result.details?.hasDisclosure).toBe(true);
    });

    it('should warn when affiliate link without disclosure', async () => {
      const html = `
        <html><body>
          <a href="https://amazon.com/product?tag=mysite-20">Buy this product</a>
        </body></html>
      `;
      const result = await affiliateDisclosureRule.run(createContext(html));
      expect(result.status).toBe('warn');
      expect(result.details?.hasAffiliateLinks).toBe(true);
      expect(result.details?.hasDisclosure).toBe(false);
    });
  });

  describe('eeat-author-byline', () => {
    it('should pass when schema.org author found', async () => {
      const html = `
        <html><head>
          <script type="application/ld+json">
            {"@type": "Article", "author": {"@type": "Person", "name": "John Doe"}}
          </script>
        </head><body>Content</body></html>
      `;
      const result = await authorBylineRule.run(createContext(html));
      expect(result.status).toBe('pass');
    });

    it('should pass when meta author tag found', async () => {
      const html = `
        <html><head>
          <meta name="author" content="Jane Smith">
        </head><body>Content</body></html>
      `;
      const result = await authorBylineRule.run(createContext(html));
      expect(result.status).toBe('pass');
    });

    it('should pass when byline class found', async () => {
      const html = `
        <html><body>
          <div class="byline">Written by John Doe</div>
          <article>Content</article>
        </body></html>
      `;
      const result = await authorBylineRule.run(createContext(html));
      expect(result.status).toBe('pass');
    });

    it('should warn when no author found', async () => {
      const html = `<html><body><article>Content without author</article></body></html>`;
      const result = await authorBylineRule.run(createContext(html));
      expect(result.status).toBe('warn');
    });
  });

  describe('eeat-author-expertise', () => {
    it('should pass when credentials found', async () => {
      const html = `
        <html><body>
          <div class="author-bio">
            Dr. John Smith, M.D., is a board-certified physician with 15+ years of experience.
          </div>
        </body></html>
      `;
      const result = await authorExpertiseRule.run(createContext(html));
      expect(result.status).toBe('pass');
      expect(result.details?.credentials?.length).toBeGreaterThan(0);
    });

    it('should pass when social profiles found', async () => {
      const html = `
        <html><body>
          <div class="author">
            <span>John Doe</span>
            <a href="https://linkedin.com/in/johndoe">LinkedIn</a>
            <a href="https://twitter.com/johndoe">Twitter</a>
          </div>
        </body></html>
      `;
      const result = await authorExpertiseRule.run(createContext(html));
      expect(result.status).toBe('pass');
      expect(result.details?.socialLinks?.length).toBeGreaterThanOrEqual(2);
    });

    it('should warn when author exists but no expertise signals', async () => {
      const html = `
        <html><head><meta name="author" content="Someone"></head>
        <body>Content</body></html>
      `;
      const result = await authorExpertiseRule.run(createContext(html));
      expect(result.status).toBe('warn');
    });
  });

  describe('eeat-citations', () => {
    it('should pass when multiple authoritative sources cited', async () => {
      const html = `
        <html><body>
          <p>According to <a href="https://cdc.gov/study">CDC</a></p>
          <p>Research from <a href="https://harvard.edu/paper">Harvard</a></p>
          <p>See also <a href="https://nih.gov/data">NIH</a></p>
        </body></html>
      `;
      const result = await citationsRule.run(createContext(html));
      expect(result.status).toBe('pass');
      expect(result.details?.citationCount).toBeGreaterThanOrEqual(3);
    });

    it('should pass with fewer citations', async () => {
      const html = `
        <html><body>
          <p>According to <a href="https://cdc.gov/data">CDC data</a></p>
        </body></html>
      `;
      const result = await citationsRule.run(createContext(html));
      expect(result.status).toBe('pass');
      expect(result.details?.citationCount).toBe(1);
    });

    it('should pass when no citations found (may not be needed)', async () => {
      const html = `<html><body><p>Content without citations</p></body></html>`;
      const result = await citationsRule.run(createContext(html));
      expect(result.status).toBe('pass');
      expect(result.details?.citationCount).toBe(0);
    });
  });

  describe('eeat-contact-page', () => {
    it('should pass when contact link and methods found', async () => {
      const html = `
        <html><body>
          <nav><a href="/contact">Contact Us</a></nav>
          <a href="mailto:info@example.com">Email us</a>
          <a href="tel:+1234567890">Call us</a>
        </body></html>
      `;
      const result = await contactPageRule.run(createContext(html));
      expect(result.status).toBe('pass');
    });

    it('should warn when no contact found', async () => {
      const html = `<html><body><main>No contact info</main></body></html>`;
      const result = await contactPageRule.run(createContext(html));
      expect(result.status).toBe('warn');
    });
  });

  describe('eeat-content-dates', () => {
    it('should pass when schema.org dates found', async () => {
      const html = `
        <html><head>
          <script type="application/ld+json">
            {"@type": "Article", "datePublished": "2024-01-15", "dateModified": "2024-01-20"}
          </script>
        </head><body>Content</body></html>
      `;
      const result = await contentDatesRule.run(createContext(html));
      expect(result.status).toBe('pass');
    });

    it('should pass when time element found', async () => {
      const html = `
        <html><body>
          <time datetime="2024-01-15">January 15, 2024</time>
          <article>Content</article>
        </body></html>
      `;
      const result = await contentDatesRule.run(createContext(html));
      expect(result.status).toBe('pass');
    });

    it('should warn when no dates found', async () => {
      const html = `<html><body><article>Content without dates</article></body></html>`;
      const result = await contentDatesRule.run(createContext(html));
      expect(result.status).toBe('warn');
    });
  });

  describe('eeat-disclaimers', () => {
    it('should pass for non-YMYL content without disclaimer', async () => {
      const html = `
        <html><body>
          <article>A recipe for chocolate chip cookies.</article>
        </body></html>
      `;
      const result = await disclaimersRule.run(createContext(html));
      expect(result.status).toBe('pass');
      expect(result.details?.isYMYL).toBe(false);
    });

    it('should pass for YMYL content with disclaimer', async () => {
      const html = `
        <html><body>
          <div class="disclaimer">This is not medical advice. Consult your doctor.</div>
          <article>
            Information about symptoms and treatment for diabetes.
            Managing your blood pressure and cholesterol levels.
          </article>
        </body></html>
      `;
      const result = await disclaimersRule.run(createContext(html));
      expect(result.status).toBe('pass');
    });

    it('should warn for YMYL content without disclaimer', async () => {
      const html = `
        <html><body>
          <article>
            Comprehensive guide to symptoms and treatment for diabetes.
            Managing your blood pressure and medication dosage.
            Information about therapy and chronic disease management.
          </article>
        </body></html>
      `;
      const result = await disclaimersRule.run(createContext(html));
      expect(result.status).toBe('warn');
      expect(result.details?.isYMYL).toBe(true);
    });
  });

  describe('eeat-editorial-policy', () => {
    it('should pass when editorial policy link found', async () => {
      const html = `
        <html><body>
          <footer><a href="/editorial-policy">Editorial Policy</a></footer>
        </body></html>
      `;
      const result = await editorialPolicyRule.run(createContext(html));
      expect(result.status).toBe('pass');
      expect(result.details?.hasEditorialPolicy).toBe(true);
    });

    it('should pass when fact-check signals found', async () => {
      const html = `
        <html><body>
          <div class="article">
            <p>Medically reviewed by Dr. Smith</p>
            <p>Fact-checked by our editorial team</p>
          </div>
        </body></html>
      `;
      const result = await editorialPolicyRule.run(createContext(html));
      expect(result.status).toBe('pass');
    });

    it('should return pass/info when no editorial policy on non-content site', async () => {
      const html = `<html><body><main>Simple page</main></body></html>`;
      const result = await editorialPolicyRule.run(createContext(html));
      expect(['pass', 'info']).toContain(result.status);
    });
  });

  describe('eeat-physical-address', () => {
    it('should pass when schema.org address found', async () => {
      const html = `
        <html><head>
          <script type="application/ld+json">
            {
              "@type": "LocalBusiness",
              "address": {
                "@type": "PostalAddress",
                "streetAddress": "123 Main St",
                "addressLocality": "New York",
                "addressRegion": "NY",
                "postalCode": "10001"
              }
            }
          </script>
        </head><body>Content</body></html>
      `;
      const result = await physicalAddressRule.run(createContext(html));
      expect(result.status).toBe('pass');
      expect(result.details?.hasAddress).toBe(true);
    });

    it('should pass when Google Maps embed found', async () => {
      const html = `
        <html><body>
          <iframe src="https://google.com/maps/embed?q=123+Main+St"></iframe>
        </body></html>
      `;
      const result = await physicalAddressRule.run(createContext(html));
      expect(result.status).toBe('pass');
    });

    it('should pass when no address on non-business site (not required)', async () => {
      const html = `<html><body><main>Blog post content</main></body></html>`;
      const result = await physicalAddressRule.run(createContext(html));
      expect(result.status).toBe('pass');
    });
  });

  describe('eeat-privacy-policy', () => {
    it('should pass when privacy policy in footer', async () => {
      const html = `
        <html><body>
          <main>Content</main>
          <footer><a href="/privacy-policy">Privacy Policy</a></footer>
        </body></html>
      `;
      const result = await privacyPolicyRule.run(createContext(html));
      expect(result.status).toBe('pass');
      expect(result.details?.inFooter).toBe(true);
    });

    it('should pass when privacy URL found', async () => {
      const html = `
        <html><body>
          <a href="/legal/privacy">Data Protection</a>
        </body></html>
      `;
      const result = await privacyPolicyRule.run(createContext(html));
      expect(result.status).toBe('pass');
    });

    it('should warn when no privacy policy found', async () => {
      const html = `<html><body><main>No privacy link</main></body></html>`;
      const result = await privacyPolicyRule.run(createContext(html));
      expect(result.status).toBe('warn');
    });
  });

  describe('eeat-terms-of-service', () => {
    it('should pass when terms link found', async () => {
      const html = `
        <html><body>
          <footer><a href="/terms-of-service">Terms of Service</a></footer>
        </body></html>
      `;
      const result = await termsOfServiceRule.run(createContext(html));
      expect(result.status).toBe('pass');
    });

    it('should warn when no ToS but e-commerce indicators present', async () => {
      const html = `
        <html><body>
          <div class="cart">Shopping Cart</div>
          <button class="add-to-cart">Add to Cart</button>
        </body></html>
      `;
      const result = await termsOfServiceRule.run(createContext(html));
      expect(result.status).toBe('warn');
    });

    it('should pass when no ToS on simple site', async () => {
      const html = `<html><body><main>Simple blog post</main></body></html>`;
      const result = await termsOfServiceRule.run(createContext(html));
      expect(result.status).toBe('pass');
    });
  });

  describe('eeat-trust-signals', () => {
    it('should pass when multiple trust signals found', async () => {
      const html = `
        <html><body>
          <div class="trust-badges">
            <img alt="BBB Accredited" src="/bbb.png">
            <div class="trustpilot-widget">4.8 out of 5 stars</div>
          </div>
          <div class="testimonials">
            <p>"Great service!" - Customer</p>
          </div>
        </body></html>
      `;
      const result = await trustSignalsRule.run(createContext(html));
      expect(result.status).toBe('pass');
      expect(result.details?.signalTypes?.length).toBeGreaterThanOrEqual(2);
    });

    it('should pass when no trust signals found (may not be required)', async () => {
      const html = `<html><body><main>Simple content</main></body></html>`;
      const result = await trustSignalsRule.run(createContext(html));
      expect(result.status).toBe('pass');
    });
  });

  describe('eeat-ymyl-detection', () => {
    it('should detect health/medical content', async () => {
      const html = `
        <html><body>
          <article>
            Guide to symptoms and treatment for diabetes.
            Managing your medication dosage and blood pressure.
            Consult your physician for proper diagnosis.
          </article>
        </body></html>
      `;
      const result = await ymylDetectionRule.run(createContext(html));
      expect(result.status).toBe('pass'); // YMYL detection is informational, returns pass
      expect(result.details?.isYMYL).toBe(true);
      expect(result.details?.categories).toContain('Health & Medical');
    });

    it('should detect financial content', async () => {
      const html = `
        <html><body>
          <article>
            Investment strategies for your 401k and retirement planning.
            Understanding mutual funds and portfolio diversification.
            Tax deductions and estate planning.
          </article>
        </body></html>
      `;
      const result = await ymylDetectionRule.run(createContext(html));
      expect(result.status).toBe('pass'); // YMYL detection is informational, returns pass
      expect(result.details?.isYMYL).toBe(true);
      expect(result.details?.categories).toContain('Financial');
    });

    it('should pass for non-YMYL content', async () => {
      const html = `
        <html><body>
          <article>A recipe for chocolate chip cookies.</article>
        </body></html>
      `;
      const result = await ymylDetectionRule.run(createContext(html));
      expect(result.status).toBe('pass');
      expect(result.details?.isYMYL).toBe(false);
    });
  });

  describe('detectYMYL utility', () => {
    it('should return correct structure', () => {
      const html = `<html><body><p>Regular content</p></body></html>`;
      const $ = cheerio.load(html);
      const result = detectYMYL($);

      expect(result).toHaveProperty('isYMYL');
      expect(result).toHaveProperty('categories');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('details');
    });

    it('should detect multiple categories', () => {
      const html = `
        <html><body>
          <article>
            Financial advice on investment and retirement planning.
            Managing your 401k, mutual fund, and portfolio.
            Tax deductions, estate planning, and financial advisor consultation.
            Legal guidance on contracts, liability, and lawsuits.
            Attorney consultation for litigation and settlement.
          </article>
        </body></html>
      `;
      const $ = cheerio.load(html);
      const result = detectYMYL($);

      expect(result.isYMYL).toBe(true);
      expect(result.categories.length).toBeGreaterThanOrEqual(1);
    });
  });
});
