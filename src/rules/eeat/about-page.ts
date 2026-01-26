import type { AuditContext, RuleResult } from '../../types.js';
import { defineRule } from '../define-rule.js';

/**
 * About page detection patterns
 */
const ABOUT_PATTERNS = {
  // Link text patterns (case insensitive)
  linkText: [
    /^about\s*us$/i,
    /^about$/i,
    /^about\s+the\s+(company|team|author)/i,
    /^who\s+we\s+are$/i,
    /^our\s+(story|mission|team|company)$/i,
    /^meet\s+the\s+team$/i,
    /^\u00fcber\s*uns$/i, // German
    /^qui\s+sommes[-\s]nous$/i, // French
    /^sobre\s+nosotros$/i, // Spanish
    /^chi\s+siamo$/i, // Italian
  ],
  // URL path patterns
  urlPaths: [
    /\/about[-_]?us\/?$/i,
    /\/about\/?$/i,
    /\/company\/?$/i,
    /\/who[-_]?we[-_]?are\/?$/i,
    /\/our[-_]?(story|team|mission)\/?$/i,
    /\/meet[-_]?the[-_]?team\/?$/i,
  ],
};

/**
 * Checks for an about/company page
 *
 * An about page builds trust by explaining who is behind the website.
 * It's a key E-E-A-T signal that helps users and search engines
 * understand the authority and expertise of content creators.
 */
export const aboutPageRule = defineRule({
  id: 'eeat-about-page',
  name: 'About Page',
  description: 'Checks for an about/company page with content',
  category: 'eeat',
  weight: 8,

  run(context: AuditContext): RuleResult {
    const { $ } = context;
    const foundLinks: Array<{ href: string; text: string; location: string }> = [];

    // Check all links
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href') || '';
      const text = $(el).text().trim();

      // Skip empty or external links
      if (!href || href.startsWith('http') && !href.includes(context.url)) {
        // Allow relative links and same-domain links
        if (href.startsWith('http')) return;
      }

      // Check link text
      for (const pattern of ABOUT_PATTERNS.linkText) {
        if (pattern.test(text)) {
          const location = detectLocation($, el);
          foundLinks.push({ href, text: text.slice(0, 50), location });
          return;
        }
      }

      // Check URL path
      for (const pattern of ABOUT_PATTERNS.urlPaths) {
        if (pattern.test(href)) {
          const location = detectLocation($, el);
          foundLinks.push({ href, text: text.slice(0, 50) || 'About', location });
          return;
        }
      }
    });

    // Check navigation specifically
    const navAbout = $('nav a, header a, [role="navigation"] a').filter((_, el) => {
      const text = $(el).text().trim().toLowerCase();
      const href = $(el).attr('href') || '';
      return text.includes('about') || /\/about/i.test(href);
    });

    if (navAbout.length > 0 && foundLinks.length === 0) {
      navAbout.each((_, el) => {
        const href = $(el).attr('href') || '';
        const text = $(el).text().trim();
        foundLinks.push({ href, text, location: 'navigation' });
      });
    }

    if (foundLinks.length > 0) {
      const inNav = foundLinks.some((link) =>
        link.location === 'navigation' || link.location === 'header'
      );

      return {
        status: 'pass',
        score: 100,
        message: `About page link found${inNav ? ' in navigation' : ''}`,
        details: {
          hasAboutPage: true,
          inNavigation: inNav,
          links: foundLinks.slice(0, 3),
        },
      };
    }

    return {
      status: 'warn',
      score: 50,
      message: 'No about page link found - important for trust and E-E-A-T',
      details: {
        hasAboutPage: false,
        recommendation: 'Add an "About" or "About Us" page explaining who you are and link to it from your navigation',
      },
    };
  },
});

/**
 * Detect element location (header, footer, navigation, body)
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

    if (tagName === 'header' || role === 'banner' || className.includes('header') || id.includes('header')) {
      return 'header';
    }

    if (tagName === 'footer' || role === 'contentinfo' || className.includes('footer') || id.includes('footer')) {
      return 'footer';
    }
  }

  return 'body';
}
