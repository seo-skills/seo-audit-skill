import type { AuditContext, RuleResult } from '../../types.js';
import { defineRule } from '../define-rule.js';

/**
 * Terms of service link detection patterns
 */
const TOS_PATTERNS = {
  // Link text patterns (case insensitive)
  linkText: [
    /terms\s*(of\s*)?(service|use)/i,
    /terms\s*(&|and)\s*conditions/i,
    /user\s*agreement/i,
    /service\s*agreement/i,
    /legal\s*terms/i,
    /nutzungsbedingungen/i, // German
    /conditions\s*d'utilisation/i, // French
    /t[eé]rminos\s*(y\s*condiciones|de\s*servicio)/i, // Spanish
    /termini\s*(di\s*servizio|e\s*condizioni)/i, // Italian
  ],
  // URL path patterns
  urlPaths: [
    /\/terms[-_]?of[-_]?service/i,
    /\/terms[-_]?of[-_]?use/i,
    /\/terms[-_]?and[-_]?conditions/i,
    /\/terms\/?$/i,
    /\/tos\/?$/i,
    /\/legal\/terms/i,
    /\/user[-_]?agreement/i,
    /\/service[-_]?agreement/i,
  ],
  // Common ToS URLs
  urls: [
    'terms-of-service',
    'terms_of_service',
    'termsofservice',
    'terms-of-use',
    'terms-and-conditions',
    'terms',
    '/tos',
    'legal/terms',
    'user-agreement',
  ],
};

/**
 * Checks for terms of service link presence (E-E-A-T trust signal)
 *
 * Terms of service define the rules for using a website or service.
 * They demonstrate professionalism and are especially important for:
 * - E-commerce sites
 * - SaaS applications
 * - User-generated content platforms
 * - Membership/subscription services
 */
export const termsOfServiceRule = defineRule({
  id: 'eeat-terms-of-service',
  name: 'Terms of Service',
  description: 'Checks for terms of service page',
  category: 'eeat',
  weight: 6,

  run(context: AuditContext): RuleResult {
    const { $ } = context;
    const foundLinks: Array<{ href: string; text: string; location: string }> = [];

    // Check all links
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href') || '';
      const text = $(el).text().trim();
      const ariaLabel = $(el).attr('aria-label') || '';
      const title = $(el).attr('title') || '';
      const combinedText = `${text} ${ariaLabel} ${title}`;

      // Check link text
      for (const pattern of TOS_PATTERNS.linkText) {
        if (pattern.test(combinedText)) {
          const location = detectLocation($, el);
          foundLinks.push({ href, text: text.slice(0, 50), location });
          return;
        }
      }

      // Check URL path
      for (const pattern of TOS_PATTERNS.urlPaths) {
        if (pattern.test(href)) {
          const location = detectLocation($, el);
          foundLinks.push({ href, text: text.slice(0, 50), location });
          return;
        }
      }

      // Check common URLs
      const hrefLower = href.toLowerCase();
      for (const url of TOS_PATTERNS.urls) {
        if (hrefLower.includes(url)) {
          const location = detectLocation($, el);
          foundLinks.push({ href, text: text.slice(0, 50), location });
          return;
        }
      }
    });

    if (foundLinks.length > 0) {
      const inFooter = foundLinks.some((link) => link.location === 'footer');

      return {
        status: 'pass',
        score: 100,
        message: `Terms of service link found${inFooter ? ' in footer' : ''} (${foundLinks.length} link${foundLinks.length > 1 ? 's' : ''})`,
        details: {
          hasTermsOfService: true,
          inFooter,
          links: foundLinks.slice(0, 3),
        },
      };
    }

    // Check if site likely needs ToS (e-commerce, SaaS indicators)
    const likelyNeedsToS = detectSiteType($);

    if (likelyNeedsToS) {
      return {
        status: 'warn',
        score: 50,
        message: 'No terms of service link found - recommended for this site type',
        details: {
          hasTermsOfService: false,
          siteType: likelyNeedsToS,
          recommendation: 'Add a link to your terms of service in the footer of every page',
        },
      };
    }

    // No ToS link found, but may not be critical
    return {
      status: 'pass',
      score: 100,
      message: 'No terms of service link found (may not be required for this site type)',
      details: {
        hasTermsOfService: false,
      },
    };
  },
});

/**
 * Detect if element is in header, footer, or main content
 */
function detectLocation($: cheerio.CheerioAPI, el: cheerio.Element): string {
  const parents = $(el).parents();

  for (let i = 0; i < parents.length; i++) {
    const parent = parents.eq(i);
    const tagName = parent.prop('tagName')?.toLowerCase() || '';
    const className = parent.attr('class')?.toLowerCase() || '';
    const id = parent.attr('id')?.toLowerCase() || '';
    const role = parent.attr('role')?.toLowerCase() || '';

    if (
      tagName === 'footer' ||
      role === 'contentinfo' ||
      className.includes('footer') ||
      id.includes('footer')
    ) {
      return 'footer';
    }

    if (
      tagName === 'header' ||
      role === 'banner' ||
      className.includes('header') ||
      id.includes('header')
    ) {
      return 'header';
    }

    if (
      tagName === 'nav' ||
      role === 'navigation' ||
      className.includes('nav')
    ) {
      return 'navigation';
    }
  }

  return 'body';
}

/**
 * Detect if the site likely needs a ToS based on content indicators
 */
function detectSiteType($: cheerio.CheerioAPI): string | null {
  // E-commerce indicators
  const hasEcommerce = $(
    '[class*="cart"], [class*="checkout"], [class*="add-to-cart"], [class*="buy-now"], [class*="product-price"], form[action*="checkout"], button:contains("Add to Cart"), button:contains("Buy Now")'
  ).length > 0;

  if (hasEcommerce) return 'e-commerce';

  // SaaS/login indicators
  const hasSaaS = $(
    'form[action*="login"], form[action*="signup"], form[action*="register"], [class*="login"], [class*="signup"], [class*="register"], button:contains("Sign Up"), button:contains("Log In"), a:contains("Sign Up"), a:contains("Create Account")'
  ).length > 0;

  if (hasSaaS) return 'SaaS/membership';

  // User-generated content indicators
  const hasUGC = $(
    '[class*="comment"], [class*="review"], form[action*="comment"], textarea[name*="comment"], [class*="user-content"]'
  ).length > 0;

  if (hasUGC) return 'user-generated content';

  return null;
}
