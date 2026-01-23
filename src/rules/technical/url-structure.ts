import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, fail } from '../define-rule.js';

/**
 * Maximum recommended URL path length
 */
const MAX_URL_PATH_LENGTH = 100;

/**
 * Maximum recommended total URL length
 */
const MAX_URL_TOTAL_LENGTH = 2048;

/**
 * Analyzes URL structure for SEO best practices
 */
function analyzeUrlStructure(url: string): {
  hasUnderscores: boolean;
  hasUppercase: boolean;
  pathLength: number;
  totalLength: number;
  issues: string[];
  path: string;
} {
  const issues: string[] = [];

  try {
    const urlObj = new URL(url);
    const path = urlObj.pathname;
    const pathLength = path.length;
    const totalLength = url.length;

    // Check for underscores in path
    const hasUnderscores = path.includes('_');
    if (hasUnderscores) {
      issues.push('URL contains underscores (use hyphens instead)');
    }

    // Check for uppercase letters in path
    const hasUppercase = path !== path.toLowerCase();
    if (hasUppercase) {
      issues.push('URL contains uppercase letters (should be lowercase)');
    }

    // Check path length
    if (pathLength > MAX_URL_PATH_LENGTH) {
      issues.push(
        `URL path is ${pathLength} characters (recommended max: ${MAX_URL_PATH_LENGTH})`
      );
    }

    // Check total URL length
    if (totalLength > MAX_URL_TOTAL_LENGTH) {
      issues.push(
        `Total URL length is ${totalLength} characters (max: ${MAX_URL_TOTAL_LENGTH})`
      );
    }

    // Check for multiple consecutive hyphens
    if (/--+/.test(path)) {
      issues.push('URL contains multiple consecutive hyphens');
    }

    // Check for special characters (excluding common allowed ones)
    const specialChars = path.match(/[^a-zA-Z0-9\-_./]/g);
    if (specialChars && specialChars.length > 0) {
      const uniqueChars = [...new Set(specialChars)].join(', ');
      issues.push(`URL contains special characters: ${uniqueChars}`);
    }

    // Check for file extensions that might indicate non-friendly URLs
    if (/\.(php|asp|aspx|jsp|cgi)\??/i.test(path)) {
      issues.push('URL contains server-side file extension (consider clean URLs)');
    }

    // Check for query parameters (not inherently bad but worth noting)
    if (urlObj.search.length > 0) {
      const paramCount = urlObj.searchParams.size;
      if (paramCount > 3) {
        issues.push(`URL has ${paramCount} query parameters (may impact crawlability)`);
      }
    }

    return {
      hasUnderscores,
      hasUppercase,
      pathLength,
      totalLength,
      issues,
      path,
    };
  } catch {
    return {
      hasUnderscores: false,
      hasUppercase: false,
      pathLength: 0,
      totalLength: url.length,
      issues: ['Could not parse URL'],
      path: '',
    };
  }
}

/**
 * Rule: Check URL structure follows SEO best practices
 */
export const urlStructureRule = defineRule({
  id: 'technical-url-structure',
  name: 'URL Structure',
  description:
    'Checks that URL uses hyphens (not underscores), is lowercase, and has reasonable length',
  category: 'technical',
  weight: 1,
  run: async (context: AuditContext) => {
    const { url } = context;
    const analysis = analyzeUrlStructure(url);

    if (analysis.issues.length === 0) {
      return pass(
        'technical-url-structure',
        'URL follows SEO best practices',
        {
          url,
          path: analysis.path,
          pathLength: analysis.pathLength,
          totalLength: analysis.totalLength,
        }
      );
    }

    // Critical issues that can hurt SEO
    const hasCriticalIssues = analysis.hasUnderscores || analysis.hasUppercase;

    if (hasCriticalIssues) {
      return fail(
        'technical-url-structure',
        `URL has structural issues: ${analysis.issues.join('; ')}`,
        {
          url,
          path: analysis.path,
          pathLength: analysis.pathLength,
          totalLength: analysis.totalLength,
          issues: analysis.issues,
        }
      );
    }

    // Non-critical issues (length, query params, etc.)
    return warn(
      'technical-url-structure',
      `URL has minor structural issues: ${analysis.issues.join('; ')}`,
      {
        url,
        path: analysis.path,
        pathLength: analysis.pathLength,
        totalLength: analysis.totalLength,
        issues: analysis.issues,
      }
    );
  },
});
