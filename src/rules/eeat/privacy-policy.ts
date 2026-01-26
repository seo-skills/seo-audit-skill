import type { AuditContext, RuleResult } from '../../types.js';
import { defineRule } from '../define-rule.js';

/**
 * Privacy policy link detection patterns
 */
const PRIVACY_PATTERNS = {
  // Link text patterns (case insensitive)
  linkText: [
    /privacy\s*policy/i,
    /privacy\s*notice/i,
    /privacy\s*statement/i,
    /data\s*protection/i,
    /datenschutz/i, // German
    /politique\s*de\s*confidentialit/i, // French
    /politica\s*de\s*privacidad/i, // Spanish
    /informativa\s*privacy/i, // Italian
  ],
  // URL path patterns
  urlPaths: [
    /\/privacy[-_]?policy/i,
    /\/privacy[-_]?notice/i,
    /\/privacy\/?$/i,
    /\/legal\/privacy/i,
    /\/data[-_]?protection/i,
    /\/datenschutz/i,
  ],
  // Common privacy policy URLs
  urls: [
    'privacy-policy',
    'privacy_policy',
    'privacypolicy',
    'privacy',
    'legal/privacy',
    'policies/privacy',
    'data-protection',
  ],
};

/**
 * Checks for privacy policy link presence (E-E-A-T trust signal)
 *
 * A privacy policy demonstrates transparency and builds trust.
 * It's also legally required in many jurisdictions (GDPR, CCPA).
 * Best practice is to link from every page footer.
 *
 * @see https://gdpr.eu/privacy-notice/
 * @see https://oag.ca.gov/privacy/ccpa
 */
export const privacyPolicyRule = defineRule({
  id: 'eeat-privacy-policy',
  name: 'Privacy Policy',
  description: 'Checks for privacy policy page linked from footer',
  category: 'eeat',
  weight: 8,

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
      for (const pattern of PRIVACY_PATTERNS.linkText) {
        if (pattern.test(combinedText)) {
          const location = detectLocation($, el);
          foundLinks.push({ href, text: text.slice(0, 50), location });
          return;
        }
      }

      // Check URL path
      for (const pattern of PRIVACY_PATTERNS.urlPaths) {
        if (pattern.test(href)) {
          const location = detectLocation($, el);
          foundLinks.push({ href, text: text.slice(0, 50), location });
          return;
        }
      }

      // Check common URLs
      const hrefLower = href.toLowerCase();
      for (const url of PRIVACY_PATTERNS.urls) {
        if (hrefLower.includes(url)) {
          const location = detectLocation($, el);
          foundLinks.push({ href, text: text.slice(0, 50), location });
          return;
        }
      }
    });

    // Check for schema.org markup
    const hasSchemaPrivacy = $('script[type="application/ld+json"]').filter((_, el) => {
      const content = $(el).html() || '';
      return /privacyPolicy|privacy.?policy/i.test(content);
    }).length > 0;

    if (foundLinks.length > 0) {
      const inFooter = foundLinks.some((link) => link.location === 'footer');

      return {
        status: 'pass',
        score: 100,
        message: `Privacy policy link found${inFooter ? ' in footer' : ''} (${foundLinks.length} link${foundLinks.length > 1 ? 's' : ''})`,
        details: {
          hasPrivacyPolicy: true,
          inFooter,
          hasSchemaMarkup: hasSchemaPrivacy,
          links: foundLinks.slice(0, 3),
        },
      };
    }

    // No privacy policy link found
    return {
      status: 'warn',
      score: 50,
      message: 'No privacy policy link found - important for trust and legal compliance',
      details: {
        hasPrivacyPolicy: false,
        recommendation: 'Add a link to your privacy policy in the footer of every page',
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
