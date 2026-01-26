import type { AuditContext, RuleResult } from '../../types.js';
import { defineRule } from '../define-rule.js';
import { detectYMYL } from './ymyl-detection.js';

/**
 * Disclaimer patterns by content type
 */
const DISCLAIMER_PATTERNS = {
  medical: [
    /not\s+(a\s+)?substitute\s+for\s+(professional\s+)?(medical|health)/i,
    /consult\s+(your\s+)?(doctor|physician|healthcare\s+provider)/i,
    /not\s+(intended\s+(as|to\s+be)\s+)?medical\s+advice/i,
    /for\s+informational\s+purposes\s+only/i,
    /seek\s+(professional\s+)?medical\s+(advice|help)/i,
    /does\s+not\s+(constitute|provide)\s+medical\s+advice/i,
  ],
  financial: [
    /not\s+(a\s+)?financial\s+advi(ce|sor)/i,
    /consult\s+(a\s+)?(financial\s+advisor|accountant|tax\s+professional)/i,
    /for\s+(educational|informational)\s+purposes\s+only/i,
    /past\s+performance\s+.{0,30}not\s+.{0,20}(guarantee|indicative)/i,
    /investment\s+risk/i,
    /not\s+investment\s+advice/i,
  ],
  legal: [
    /not\s+(a\s+)?legal\s+advice/i,
    /consult\s+(an?\s+)?(attorney|lawyer|legal\s+professional)/i,
    /does\s+not\s+(create|establish)\s+(an?\s+)?attorney[-\s]client/i,
    /for\s+informational\s+purposes\s+only/i,
    /seek\s+(professional\s+)?legal\s+(advice|counsel)/i,
  ],
  general: [
    /disclaimer/i,
    /we\s+(are|make)\s+no\s+(warranties|guarantees|representations)/i,
    /at\s+your\s+own\s+risk/i,
    /results\s+may\s+vary/i,
    /individual\s+results\s+(may\s+)?vary/i,
  ],
};

/**
 * Disclaimer location selectors
 */
const DISCLAIMER_SELECTORS = [
  '.disclaimer',
  '.notice',
  '.warning',
  '.legal-notice',
  '.medical-disclaimer',
  '.financial-disclaimer',
  '[class*="disclaimer"]',
  '[class*="notice"]',
  '[id*="disclaimer"]',
  'small',
  '.fine-print',
];

/**
 * Checks for appropriate disclaimers on sensitive content
 *
 * YMYL (Your Money Your Life) content should include appropriate
 * disclaimers to protect both users and publishers.
 */
export const disclaimersRule = defineRule({
  id: 'eeat-disclaimers',
  name: 'Disclaimers',
  description: 'Checks for appropriate disclaimers on sensitive content',
  category: 'eeat',
  weight: 4,

  run(context: AuditContext): RuleResult {
    const { $ } = context;

    // First, detect if this is YMYL content
    const ymylResult = detectYMYL($);

    // Get all page text for disclaimer detection
    const bodyText = $('body').text();

    // Check disclaimer areas specifically
    let disclaimerAreaText = '';
    for (const selector of DISCLAIMER_SELECTORS) {
      $(selector).each((_, el) => {
        disclaimerAreaText += ' ' + $(el).text();
      });
    }

    const foundDisclaimers: Array<{ type: string; text: string }> = [];

    // Check for disclaimers based on YMYL categories
    const categoriesToCheck = ymylResult.isYMYL
      ? ymylResult.categories.map((c) => c.toLowerCase().replace(/[^a-z]/g, ''))
      : [];

    // Map category names to disclaimer pattern keys
    const categoryToPatternKey: Record<string, keyof typeof DISCLAIMER_PATTERNS> = {
      healthmedical: 'medical',
      financial: 'financial',
      legal: 'legal',
    };

    // Check specific disclaimers for YMYL categories
    for (const category of categoriesToCheck) {
      const patternKey = categoryToPatternKey[category];
      if (patternKey && DISCLAIMER_PATTERNS[patternKey]) {
        for (const pattern of DISCLAIMER_PATTERNS[patternKey]) {
          // Check disclaimer areas first, then full body
          const textToCheck = disclaimerAreaText || bodyText;
          const match = textToCheck.match(pattern);
          if (match) {
            foundDisclaimers.push({
              type: patternKey,
              text: match[0].slice(0, 100),
            });
            break; // One match per category is enough
          }
        }
      }
    }

    // Check for general disclaimers
    for (const pattern of DISCLAIMER_PATTERNS.general) {
      const match = (disclaimerAreaText || bodyText).match(pattern);
      if (match) {
        foundDisclaimers.push({
          type: 'general',
          text: match[0].slice(0, 100),
        });
        break;
      }
    }

    // Check for visible disclaimer section
    const hasDisclaimerSection = $(DISCLAIMER_SELECTORS.join(', ')).length > 0;

    // Evaluate results based on YMYL status
    if (!ymylResult.isYMYL) {
      // Non-YMYL content doesn't require disclaimers
      if (foundDisclaimers.length > 0) {
        return {
          status: 'pass',
          score: 100,
          message: `Disclaimer found (not required for non-YMYL content)`,
          details: {
            isYMYL: false,
            disclaimers: foundDisclaimers,
            hasDisclaimerSection,
          },
        };
      }

      return {
        status: 'pass',
        score: 100,
        message: 'Non-YMYL content - disclaimers not required',
        details: {
          isYMYL: false,
          disclaimers: [],
        },
      };
    }

    // YMYL content - disclaimers are important
    const requiredCategories = categoriesToCheck.filter((c) => categoryToPatternKey[c]);
    const foundCategories = foundDisclaimers.map((d) => d.type).filter((t) => t !== 'general');

    if (foundDisclaimers.length > 0 && foundCategories.length >= requiredCategories.length) {
      return {
        status: 'pass',
        score: 100,
        message: `Appropriate disclaimers found for YMYL content (${ymylResult.categories.join(', ')})`,
        details: {
          isYMYL: true,
          ymylCategories: ymylResult.categories,
          disclaimers: foundDisclaimers,
          hasDisclaimerSection,
        },
      };
    }

    if (foundDisclaimers.length > 0) {
      return {
        status: 'pass',
        score: 80,
        message: `Disclaimer found, but may need category-specific disclaimer for ${ymylResult.categories.join(', ')} content`,
        details: {
          isYMYL: true,
          ymylCategories: ymylResult.categories,
          disclaimers: foundDisclaimers,
          hasDisclaimerSection,
          recommendation: `Consider adding specific disclaimers for ${ymylResult.categories.join(', ')} content`,
        },
      };
    }

    // YMYL content without disclaimers
    return {
      status: 'warn',
      score: 50,
      message: `YMYL content (${ymylResult.categories.join(', ')}) without appropriate disclaimers`,
      details: {
        isYMYL: true,
        ymylCategories: ymylResult.categories,
        confidence: ymylResult.confidence,
        disclaimers: [],
        recommendation: getDisclaimerRecommendation(ymylResult.categories),
      },
    };
  },
});

/**
 * Get specific disclaimer recommendation based on YMYL categories
 */
function getDisclaimerRecommendation(categories: string[]): string {
  const recommendations: string[] = [];

  for (const category of categories) {
    const lower = category.toLowerCase();
    if (lower.includes('health') || lower.includes('medical')) {
      recommendations.push('Add medical disclaimer: "This content is for informational purposes only and is not a substitute for professional medical advice"');
    }
    if (lower.includes('financial')) {
      recommendations.push('Add financial disclaimer: "This is not financial advice. Consult a qualified financial advisor"');
    }
    if (lower.includes('legal')) {
      recommendations.push('Add legal disclaimer: "This is not legal advice. Consult a licensed attorney"');
    }
  }

  return recommendations.length > 0
    ? recommendations.join('. ')
    : 'Add appropriate disclaimers for sensitive content';
}
