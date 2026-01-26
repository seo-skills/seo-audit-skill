import type { AuditContext, RuleResult } from '../../types.js';
import { defineRule } from '../define-rule.js';

/**
 * YMYL (Your Money Your Life) content categories and detection patterns
 */
export const YMYL_CATEGORIES = {
  health: {
    name: 'Health & Medical',
    patterns: [
      /\b(symptom|diagnos|treatment|medication|dosage|prescription|disease|illness|condition|surgery|medical|health|doctor|physician|nurse|hospital|clinic|patient|therapy|cure|remedy|vaccine|infection|chronic|acute)\b/gi,
      /\b(cancer|diabetes|heart|blood\s*pressure|cholesterol|depression|anxiety|mental\s*health|addiction|pregnancy|fertility|nutrition|diet|weight\s*loss|supplement|vitamin)\b/gi,
    ],
    threshold: 5, // Minimum pattern matches
  },
  financial: {
    name: 'Financial',
    patterns: [
      /\b(invest|investment|stock|bond|mutual\s*fund|retirement|401k|ira|pension|mortgage|loan|debt|credit|interest\s*rate|apr|compound|portfolio|dividend|capital\s*gain)\b/gi,
      /\b(tax|deduction|refund|irs|accountant|cpa|financial\s*advisor|estate\s*planning|insurance|premium|coverage|claim|bankruptcy|foreclosure)\b/gi,
      /\b(bank|banking|savings|checking|wire\s*transfer|cryptocurrency|bitcoin|ethereum|trading|forex|broker)\b/gi,
    ],
    threshold: 4,
  },
  legal: {
    name: 'Legal',
    patterns: [
      /\b(attorney|lawyer|legal\s*advice|lawsuit|litigation|court|judge|jury|verdict|settlement|damages|liability|negligence|contract|agreement|clause)\b/gi,
      /\b(divorce|custody|alimony|will|trust|estate|probate|power\s*of\s*attorney|criminal|felony|misdemeanor|bail|parole|immigration|visa|asylum)\b/gi,
    ],
    threshold: 4,
  },
  safety: {
    name: 'Safety & Security',
    patterns: [
      /\b(emergency|evacuation|disaster|natural\s*disaster|earthquake|hurricane|flood|fire\s*safety|first\s*aid|cpr|heimlich|poison|toxic|hazard|warning)\b/gi,
      /\b(self[-\s]?defense|home\s*security|identity\s*theft|fraud|scam|phishing|cybersecurity|password|encryption)\b/gi,
    ],
    threshold: 3,
  },
  news: {
    name: 'News & Current Events',
    patterns: [
      /\b(breaking\s*news|election|government|policy|legislation|congress|senate|president|prime\s*minister|political|geopolitical)\b/gi,
      /\b(pandemic|outbreak|public\s*health|crisis|emergency\s*declaration)\b/gi,
    ],
    threshold: 3,
  },
};

export interface YMYLDetectionResult {
  isYMYL: boolean;
  categories: string[];
  confidence: 'high' | 'medium' | 'low' | 'none';
  details: Record<string, { matches: number; threshold: number }>;
}

/**
 * Detect YMYL content in a page
 * Exported for use by other rules (disclaimers, etc.)
 */
export function detectYMYL($: cheerio.CheerioAPI): YMYLDetectionResult {
  // Get main content text (exclude nav, footer, sidebar)
  const mainContent = $('main, article, [role="main"], .content, .post-content, .entry-content')
    .first()
    .text();
  const bodyText = mainContent || $('body').text();

  // Also check title and meta description
  const title = $('title').text() || '';
  const metaDesc = $('meta[name="description"]').attr('content') || '';
  const fullText = `${title} ${metaDesc} ${bodyText}`;

  const detectedCategories: string[] = [];
  const details: Record<string, { matches: number; threshold: number }> = {};

  for (const [key, category] of Object.entries(YMYL_CATEGORIES)) {
    let totalMatches = 0;

    for (const pattern of category.patterns) {
      const matches = fullText.match(pattern);
      if (matches) {
        totalMatches += matches.length;
      }
    }

    details[key] = { matches: totalMatches, threshold: category.threshold };

    if (totalMatches >= category.threshold) {
      detectedCategories.push(category.name);
    }
  }

  // Determine confidence level
  let confidence: 'high' | 'medium' | 'low' | 'none' = 'none';
  const maxMatches = Math.max(...Object.values(details).map((d) => d.matches));

  if (detectedCategories.length >= 2 || maxMatches >= 15) {
    confidence = 'high';
  } else if (detectedCategories.length === 1 && maxMatches >= 8) {
    confidence = 'medium';
  } else if (detectedCategories.length === 1) {
    confidence = 'low';
  }

  return {
    isYMYL: detectedCategories.length > 0,
    categories: detectedCategories,
    confidence,
    details,
  };
}

/**
 * Rule: Detect YMYL (Your Money Your Life) content
 *
 * YMYL content requires higher E-E-A-T standards according to Google's
 * Quality Rater Guidelines. This rule identifies pages that may contain
 * YMYL topics so other E-E-A-T checks can be weighted appropriately.
 *
 * @see https://developers.google.com/search/docs/fundamentals/creating-helpful-content
 */
export const ymylDetectionRule = defineRule({
  id: 'eeat-ymyl-detection',
  name: 'YMYL Detection',
  description: 'Detects Your Money Your Life (YMYL) content',
  category: 'eeat',
  weight: 5,

  run(context: AuditContext): RuleResult {
    const { $ } = context;
    const result = detectYMYL($);

    if (result.isYMYL) {
      return {
        status: 'pass',
        score: 100, // YMYL detection is informational, not a problem
        message: `YMYL content detected: ${result.categories.join(', ')} (${result.confidence} confidence)`,
        details: {
          isYMYL: true,
          categories: result.categories,
          confidence: result.confidence,
          categoryDetails: result.details,
          recommendation: 'YMYL content requires strong E-E-A-T signals: author credentials, citations, disclaimers',
        },
      };
    }

    return {
      status: 'pass',
      score: 100,
      message: 'No YMYL content detected',
      details: {
        isYMYL: false,
        categories: [],
        confidence: 'none',
      },
    };
  },
});
