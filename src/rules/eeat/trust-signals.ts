import type { AuditContext, RuleResult } from '../../types.js';
import { defineRule } from '../define-rule.js';

/**
 * Trust badge and certification patterns
 */
const TRUST_BADGES = {
  security: {
    patterns: [
      /ssl\s*(secured?|certificate)/i,
      /secure\s*(checkout|payment|site)/i,
      /pci\s*(dss|compliant)/i,
      /256[-\s]?bit\s*encryption/i,
      /mcafee\s*secure/i,
      /norton\s*secured?/i,
      /verisign/i,
      /digicert/i,
      /comodo/i,
      /trustwave/i,
    ],
    selectors: [
      '[class*="ssl"]',
      '[class*="secure-badge"]',
      '[class*="security-seal"]',
      'img[alt*="SSL"]',
      'img[alt*="Secure"]',
      'img[src*="ssl"]',
      'img[src*="secure"]',
    ],
  },
  business: {
    patterns: [
      /better\s*business\s*bureau|bbb/i,
      /chamber\s*of\s*commerce/i,
      /accredited\s*business/i,
      /certified\s*(by|partner)/i,
      /official\s*partner/i,
      /authorized\s*(dealer|reseller|partner)/i,
      /iso\s*\d{4,5}/i,
      /soc\s*2/i,
    ],
    selectors: [
      '[class*="bbb"]',
      '[class*="accredited"]',
      '[class*="certified"]',
      'img[alt*="BBB"]',
      'img[alt*="Certified"]',
      'img[alt*="Accredited"]',
    ],
  },
  reviews: {
    patterns: [
      /trustpilot/i,
      /google\s*reviews?/i,
      /yelp/i,
      /\d+(\.\d)?\s*(out\s*of\s*5|stars?)/i,
      /\d+\+?\s*reviews?/i,
      /rated\s*\d+(\.\d)?/i,
      /customer\s*rating/i,
      /testimonials?/i,
      /feefo/i,
      /reviews\.io/i,
      /judge\.me/i,
    ],
    selectors: [
      '[class*="trustpilot"]',
      '[class*="review"]',
      '[class*="rating"]',
      '[class*="testimonial"]',
      '[class*="stars"]',
      '.star-rating',
      '[itemtype*="Review"]',
      '[itemtype*="Rating"]',
    ],
  },
  media: {
    patterns: [
      /as\s*(seen|featured)\s*(in|on)/i,
      /featured\s*(in|on|by)/i,
      /press\s*(coverage|mentions)/i,
      /in\s*the\s*(news|media)/i,
      /trusted\s*by/i,
      /used\s*by\s*\d+/i,
      /\d+\+?\s*customers?/i,
      /\d+\+?\s*(companies|businesses|brands)/i,
    ],
    selectors: [
      '[class*="press"]',
      '[class*="media"]',
      '[class*="featured"]',
      '[class*="as-seen"]',
      '[class*="logo-bar"]',
      '[class*="client-logos"]',
      '[class*="trusted-by"]',
    ],
  },
  payment: {
    patterns: [
      /money[-\s]?back\s*guarantee/i,
      /\d+[-\s]?day\s*(refund|return|guarantee)/i,
      /free\s*(returns?|shipping)/i,
      /satisfaction\s*guarantee/i,
      /secure\s*payment/i,
      /visa|mastercard|amex|paypal|stripe/i,
    ],
    selectors: [
      '[class*="guarantee"]',
      '[class*="payment-icons"]',
      '[class*="payment-methods"]',
      'img[alt*="Visa"]',
      'img[alt*="PayPal"]',
      'img[alt*="Mastercard"]',
    ],
  },
  professional: {
    patterns: [
      /member\s*of/i,
      /affiliated\s*with/i,
      /association/i,
      /board[-\s]?certified/i,
      /licensed/i,
      /registered/i,
      /award[-\s]?winning/i,
      /best\s*of\s*\d{4}/i,
    ],
    selectors: [
      '[class*="award"]',
      '[class*="badge"]',
      '[class*="certification"]',
      '[class*="member"]',
      '[class*="association"]',
    ],
  },
};

/**
 * Checks for trust badges, certifications, and social proof
 *
 * Trust signals like reviews, certifications, media mentions,
 * and security badges help establish credibility and authority.
 */
export const trustSignalsRule = defineRule({
  id: 'eeat-trust-signals',
  name: 'Trust Signals',
  description: 'Checks for trust badges, certifications, and social proof',
  category: 'eeat',
  weight: 6,

  run(context: AuditContext): RuleResult {
    const { $ } = context;
    const foundSignals: Array<{ type: string; evidence: string }> = [];
    const bodyText = $('body').text();

    // Check each trust signal category
    for (const [category, config] of Object.entries(TRUST_BADGES)) {
      // Check patterns in text
      for (const pattern of config.patterns) {
        const match = bodyText.match(pattern);
        if (match) {
          foundSignals.push({
            type: category,
            evidence: `Text: "${match[0].slice(0, 50)}"`,
          });
          break; // One match per category is enough
        }
      }

      // Check selectors
      for (const selector of config.selectors) {
        if ($(selector).length > 0) {
          const text = $(selector).first().text().trim().slice(0, 50);
          const existingForCategory = foundSignals.find((s) => s.type === category);
          if (!existingForCategory) {
            foundSignals.push({
              type: category,
              evidence: `Element: ${selector}${text ? ` ("${text}")` : ''}`,
            });
          }
          break;
        }
      }
    }

    // Check for Schema.org Review/Rating
    const hasSchemaReviews = $('script[type="application/ld+json"]').filter((_, el) => {
      const content = $(el).html() || '';
      return /Review|AggregateRating|rating/i.test(content);
    }).length > 0;

    if (hasSchemaReviews && !foundSignals.find((s) => s.type === 'reviews')) {
      foundSignals.push({
        type: 'reviews',
        evidence: 'Schema.org Review/Rating markup',
      });
    }

    // Check for social proof numbers
    const socialProofPattern = /(\d{1,3}(,\d{3})*|\d+[kKmM]?)\+?\s*(customers?|users?|clients?|subscribers?|downloads?|reviews?)/gi;
    const socialProofMatch = bodyText.match(socialProofPattern);
    if (socialProofMatch && !foundSignals.find((s) => s.type === 'media')) {
      foundSignals.push({
        type: 'social-proof',
        evidence: `Text: "${socialProofMatch[0].slice(0, 50)}"`,
      });
    }

    // Group signals by type
    const signalsByType: Record<string, string[]> = {};
    for (const signal of foundSignals) {
      if (!signalsByType[signal.type]) {
        signalsByType[signal.type] = [];
      }
      signalsByType[signal.type].push(signal.evidence);
    }

    const uniqueTypes = Object.keys(signalsByType);

    if (uniqueTypes.length >= 3) {
      return {
        status: 'pass',
        score: 100,
        message: `Strong trust signals: ${uniqueTypes.length} types of social proof found`,
        details: {
          signalCount: foundSignals.length,
          signalTypes: uniqueTypes,
          signals: signalsByType,
        },
      };
    }

    if (uniqueTypes.length >= 2) {
      return {
        status: 'pass',
        score: 90,
        message: `Trust signals found: ${uniqueTypes.join(', ')}`,
        details: {
          signalCount: foundSignals.length,
          signalTypes: uniqueTypes,
          signals: signalsByType,
          recommendation: 'Consider adding more trust signals: reviews, certifications, media mentions',
        },
      };
    }

    if (uniqueTypes.length === 1) {
      return {
        status: 'pass',
        score: 80,
        message: `Trust signal found: ${uniqueTypes[0]}`,
        details: {
          signalCount: foundSignals.length,
          signalTypes: uniqueTypes,
          signals: signalsByType,
          recommendation: 'Add more types of trust signals: customer reviews, certifications, security badges, media mentions',
        },
      };
    }

    return {
      status: 'pass',
      score: 100,
      message: 'No trust signals detected (may not be required for this site type)',
      details: {
        signalCount: 0,
        signalTypes: [],
        recommendation: 'Add trust signals: customer reviews/testimonials, certifications, security badges, media mentions, or client logos',
      },
    };
  },
});
