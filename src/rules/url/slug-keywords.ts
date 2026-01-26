import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, fail } from '../define-rule.js';

/**
 * Patterns that indicate generic/non-descriptive URLs
 */
const GENERIC_PATTERNS = [
  // Numeric IDs
  /^\/?\d+$/,
  /^\/?(p|post|page|article|product|item|id)[-_]?\d+$/i,
  /^\/?\w+[-_]?\d{4,}$/i, // word followed by 4+ digits

  // UUID patterns
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,

  // Hash-like patterns
  /^\/?\w*[0-9a-f]{16,}\w*$/i,

  // Common generic slugs
  /^\/?untitled(-\d+)?$/i,
  /^\/?new-page(-\d+)?$/i,
  /^\/?copy(-of)?(-\d+)?$/i,
];

/**
 * Patterns that indicate dynamic/parameterized URLs
 */
const DYNAMIC_PATTERNS = [
  // Query-based content
  /^\/?(\?|#)/,
  /\.(php|asp|aspx|jsp|cgi)\?/i,

  // Common CMS patterns with IDs
  /^\/?node\/\d+$/i,
  /^\/?\?p=\d+$/i,
  /^\/?index\.(php|html?)(\?|$)/i,
];

/**
 * Minimum slug length to be considered descriptive
 */
const MIN_SLUG_LENGTH = 3;

/**
 * Check if a slug segment appears to be descriptive
 */
function isDescriptiveSlug(slug: string): boolean {
  // Too short to be descriptive
  if (slug.length < MIN_SLUG_LENGTH) {
    return false;
  }

  // Pure numbers are not descriptive
  if (/^\d+$/.test(slug)) {
    return false;
  }

  // Hash-like strings are not descriptive
  if (/^[0-9a-f]{8,}$/i.test(slug) && !/[g-zG-Z]/.test(slug)) {
    return false;
  }

  // Contains at least some letters
  return /[a-zA-Z]{2,}/.test(slug);
}

/**
 * Analyze URL slug for keyword presence
 */
function analyzeSlug(url: string): {
  path: string;
  slugs: string[];
  hasDescriptiveSlug: boolean;
  isGeneric: boolean;
  isDynamic: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  try {
    const urlObj = new URL(url);
    const path = urlObj.pathname;

    // Check for dynamic patterns
    const fullUrl = path + urlObj.search;
    for (const pattern of DYNAMIC_PATTERNS) {
      if (pattern.test(fullUrl)) {
        return {
          path,
          slugs: [],
          hasDescriptiveSlug: false,
          isGeneric: false,
          isDynamic: true,
          issues: ['URL uses dynamic parameters instead of descriptive slugs'],
        };
      }
    }

    // Check for generic patterns
    for (const pattern of GENERIC_PATTERNS) {
      if (pattern.test(path)) {
        return {
          path,
          slugs: [],
          hasDescriptiveSlug: false,
          isGeneric: true,
          isDynamic: false,
          issues: ['URL uses generic identifiers instead of descriptive keywords'],
        };
      }
    }

    // Extract slug segments (exclude empty segments and file extensions)
    const segments = path
      .split('/')
      .filter((s) => s.length > 0)
      .map((s) => s.replace(/\.[^.]+$/, '')); // Remove file extensions

    if (segments.length === 0) {
      // Root path - always pass
      return {
        path,
        slugs: [],
        hasDescriptiveSlug: true,
        isGeneric: false,
        isDynamic: false,
        issues: [],
      };
    }

    // Check if any segment is descriptive
    const descriptiveSegments = segments.filter(isDescriptiveSlug);
    const hasDescriptiveSlug = descriptiveSegments.length > 0;

    if (!hasDescriptiveSlug) {
      issues.push('URL path lacks descriptive keywords');
    }

    return {
      path,
      slugs: segments,
      hasDescriptiveSlug,
      isGeneric: false,
      isDynamic: false,
      issues,
    };
  } catch {
    return {
      path: url,
      slugs: [],
      hasDescriptiveSlug: false,
      isGeneric: false,
      isDynamic: false,
      issues: ['Could not parse URL'],
    };
  }
}

/**
 * Rule: Check if URL slug contains relevant keywords
 */
export const slugKeywordsRule = defineRule({
  id: 'url-slug-keywords',
  name: 'Slug Keywords',
  description:
    'Checks if URL slug contains relevant keywords rather than generic identifiers',
  category: 'url',
  weight: 15,
  run: async (context: AuditContext) => {
    const { url } = context;
    const analysis = analyzeSlug(url);

    const details = {
      url,
      path: analysis.path,
      slugSegments: analysis.slugs,
      hasDescriptiveSlug: analysis.hasDescriptiveSlug,
      isGeneric: analysis.isGeneric,
      isDynamic: analysis.isDynamic,
    };

    // Dynamic URLs with parameters are problematic
    if (analysis.isDynamic) {
      return fail(
        'url-slug-keywords',
        analysis.issues[0] || 'URL uses dynamic parameters instead of descriptive slugs',
        details
      );
    }

    // Generic IDs instead of keywords
    if (analysis.isGeneric) {
      return fail(
        'url-slug-keywords',
        analysis.issues[0] || 'URL uses generic identifiers instead of keywords',
        details
      );
    }

    // Has descriptive slugs
    if (analysis.hasDescriptiveSlug) {
      return pass(
        'url-slug-keywords',
        `URL contains descriptive keywords: ${analysis.slugs.join('/')}`,
        details
      );
    }

    // Path lacks keywords but isn't obviously generic
    return warn(
      'url-slug-keywords',
      'URL path may lack descriptive keywords',
      details
    );
  },
});
