import type { AuditContext, RuleResult } from '../../types.js';
import { defineRule } from '../define-rule.js';

/**
 * Contact page detection patterns
 */
const CONTACT_PATTERNS = {
  // Link text patterns (case insensitive)
  linkText: [
    /^contact\s*us$/i,
    /^contact$/i,
    /^get\s+in\s+touch$/i,
    /^reach\s+(out|us)$/i,
    /^support$/i,
    /^help$/i,
    /^kontakt$/i, // German
    /^contactez[-\s]nous$/i, // French
    /^contacto$/i, // Spanish
    /^contatti$/i, // Italian
  ],
  // URL path patterns
  urlPaths: [
    /\/contact[-_]?us\/?$/i,
    /\/contact\/?$/i,
    /\/get[-_]?in[-_]?touch\/?$/i,
    /\/reach[-_]?us\/?$/i,
    /\/support\/?$/i,
    /\/help\/?$/i,
  ],
};

/**
 * Contact method detection patterns
 */
const CONTACT_METHODS = {
  email: {
    pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/,
    selector: 'a[href^="mailto:"]',
  },
  phone: {
    pattern: /(\+?1?[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/,
    selector: 'a[href^="tel:"]',
  },
  form: {
    selector: 'form[action*="contact"], form[id*="contact"], form[class*="contact"], form:has(textarea)',
  },
  address: {
    // Schema.org PostalAddress
    selector: '[itemtype*="PostalAddress"], [itemprop="address"]',
  },
  chat: {
    selector: '[class*="chat"], [id*="chat"], [class*="intercom"], [class*="zendesk"], [class*="crisp"], [class*="drift"]',
  },
};

/**
 * Checks for contact page with multiple contact methods
 *
 * A contact page with multiple ways to reach the business builds trust.
 * It shows transparency and accessibility, key E-E-A-T signals.
 */
export const contactPageRule = defineRule({
  id: 'eeat-contact-page',
  name: 'Contact Page',
  description: 'Checks for contact page with multiple contact methods',
  category: 'eeat',
  weight: 8,

  run(context: AuditContext): RuleResult {
    const { $ } = context;
    const foundLinks: Array<{ href: string; text: string; location: string }> = [];
    const foundMethods: string[] = [];

    // Check for contact page links
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href') || '';
      const text = $(el).text().trim();

      // Check link text
      for (const pattern of CONTACT_PATTERNS.linkText) {
        if (pattern.test(text)) {
          const location = detectLocation($, el);
          foundLinks.push({ href, text: text.slice(0, 50), location });
          return;
        }
      }

      // Check URL path
      for (const pattern of CONTACT_PATTERNS.urlPaths) {
        if (pattern.test(href)) {
          const location = detectLocation($, el);
          foundLinks.push({ href, text: text.slice(0, 50) || 'Contact', location });
          return;
        }
      }
    });

    // Check for contact methods on current page
    // Email
    if ($(CONTACT_METHODS.email.selector).length > 0) {
      foundMethods.push('email');
    } else {
      const bodyText = $('body').text();
      if (CONTACT_METHODS.email.pattern.test(bodyText)) {
        foundMethods.push('email (visible)');
      }
    }

    // Phone
    if ($(CONTACT_METHODS.phone.selector).length > 0) {
      foundMethods.push('phone');
    } else {
      const bodyText = $('body').text();
      if (CONTACT_METHODS.phone.pattern.test(bodyText)) {
        foundMethods.push('phone (visible)');
      }
    }

    // Form
    if ($(CONTACT_METHODS.form.selector).length > 0) {
      foundMethods.push('contact form');
    }

    // Address
    if ($(CONTACT_METHODS.address.selector).length > 0) {
      foundMethods.push('address (structured)');
    }

    // Live chat
    if ($(CONTACT_METHODS.chat.selector).length > 0) {
      foundMethods.push('live chat');
    }

    // Check Schema.org ContactPoint
    const hasSchemaContact = $('script[type="application/ld+json"]').filter((_, el) => {
      const content = $(el).html() || '';
      return /ContactPoint|contactPoint/i.test(content);
    }).length > 0;

    if (hasSchemaContact) {
      foundMethods.push('Schema.org ContactPoint');
    }

    const hasContactPage = foundLinks.length > 0;
    const methodCount = foundMethods.length;

    if (hasContactPage && methodCount >= 2) {
      return {
        status: 'pass',
        score: 100,
        message: `Contact page found with ${methodCount} contact methods`,
        details: {
          hasContactPage: true,
          contactMethods: foundMethods,
          links: foundLinks.slice(0, 3),
        },
      };
    }

    if (hasContactPage || methodCount >= 2) {
      return {
        status: 'pass',
        score: 100,
        message: hasContactPage
          ? `Contact page found${methodCount > 0 ? ` (${methodCount} contact method${methodCount > 1 ? 's' : ''} visible)` : ''}`
          : `${methodCount} contact methods found on page`,
        details: {
          hasContactPage,
          contactMethods: foundMethods,
          links: foundLinks.slice(0, 3),
        },
      };
    }

    if (methodCount === 1) {
      return {
        status: 'warn',
        score: 70,
        message: `Only 1 contact method found (${foundMethods[0]}) - add more for better trust signals`,
        details: {
          hasContactPage: false,
          contactMethods: foundMethods,
          recommendation: 'Add a contact page with multiple ways to reach you: email, phone, form, and/or physical address',
        },
      };
    }

    return {
      status: 'warn',
      score: 50,
      message: 'No contact page or contact methods found - important for trust',
      details: {
        hasContactPage: false,
        contactMethods: [],
        recommendation: 'Add a contact page with multiple ways to reach you: email, phone, contact form, and physical address',
      },
    };
  },
});

/**
 * Detect element location
 */
function detectLocation($: cheerio.CheerioAPI, el: cheerio.Element): string {
  const parents = $(el).parents();

  for (let i = 0; i < parents.length; i++) {
    const parent = parents.eq(i);
    const tagName = parent.prop('tagName')?.toLowerCase() || '';
    const className = parent.attr('class')?.toLowerCase() || '';
    const id = parent.attr('id')?.toLowerCase() || '';
    const role = parent.attr('role')?.toLowerCase() || '';

    if (tagName === 'nav' || role === 'navigation' || className.includes('nav')) {
      return 'navigation';
    }

    if (tagName === 'header' || role === 'banner' || className.includes('header')) {
      return 'header';
    }

    if (tagName === 'footer' || role === 'contentinfo' || className.includes('footer')) {
      return 'footer';
    }
  }

  return 'body';
}
