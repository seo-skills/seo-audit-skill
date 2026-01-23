/**
 * Rule Pattern Matcher Module
 * Matches rule IDs against patterns with wildcard support
 */

/**
 * Convert a rule pattern to a regular expression
 * Supports:
 * - `*` at end matches everything after the prefix (e.g., `meta-tags-*`)
 * - `*` alone matches all rules
 * - Literal strings match exactly
 */
function patternToRegex(pattern: string): RegExp {
  // Handle the special case of just `*` (matches everything)
  if (pattern === '*') {
    return /^.*$/;
  }

  // Escape special regex characters except *
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');

  // Replace * with regex wildcard
  const regexStr = escaped.replace(/\*/g, '.*');

  return new RegExp(`^${regexStr}$`);
}

/**
 * Check if a rule ID matches a pattern
 * @param ruleId - Rule identifier (e.g., 'meta-tags-title-present')
 * @param pattern - Pattern to match (e.g., 'meta-tags-*', '*', 'meta-tags-title-present')
 * @returns true if the rule matches the pattern
 */
export function matchesPattern(ruleId: string, pattern: string): boolean {
  const regex = patternToRegex(pattern);
  return regex.test(ruleId);
}

/**
 * Check if a rule ID matches any of the given patterns
 * @param ruleId - Rule identifier
 * @param patterns - Array of patterns to match against
 * @returns true if the rule matches any pattern
 */
export function matchesAnyPattern(ruleId: string, patterns: string[]): boolean {
  return patterns.some(pattern => matchesPattern(ruleId, pattern));
}

/**
 * Determine if a rule is enabled based on enable/disable patterns
 * Logic:
 * - If no enable patterns, all rules are enabled by default
 * - If enable patterns exist, rule must match at least one to be enabled
 * - If rule matches any disable pattern, it is disabled (disable takes precedence)
 *
 * @param ruleId - Rule identifier
 * @param enable - Array of enable patterns (empty means all enabled)
 * @param disable - Array of disable patterns
 * @returns true if the rule should be enabled
 */
export function isRuleEnabled(
  ruleId: string,
  enable: string[],
  disable: string[]
): boolean {
  // Check disable patterns first (they take precedence)
  if (disable.length > 0 && matchesAnyPattern(ruleId, disable)) {
    return false;
  }

  // If no enable patterns, rule is enabled by default
  if (enable.length === 0) {
    return true;
  }

  // Check if rule matches any enable pattern
  return matchesAnyPattern(ruleId, enable);
}

/**
 * Filter an array of rule IDs based on enable/disable patterns
 * @param ruleIds - Array of rule identifiers
 * @param enable - Array of enable patterns
 * @param disable - Array of disable patterns
 * @returns Filtered array of enabled rule IDs
 */
export function filterRules(
  ruleIds: string[],
  enable: string[],
  disable: string[]
): string[] {
  return ruleIds.filter(ruleId => isRuleEnabled(ruleId, enable, disable));
}

/**
 * Get the category from a rule ID
 * Convention: rules are named `category-name` where category is the first part
 * @param ruleId - Rule identifier (e.g., 'meta-tags-title-present')
 * @returns Category name or null if not determinable
 */
export function getRuleCategory(ruleId: string): string | null {
  // Common category prefixes based on the codebase
  const categories = [
    'meta-tags',
    'core-web-vitals',
    'structured-data',
    'headings',
    'technical',
    'links',
    'images',
    'security',
    'social',
  ];

  for (const category of categories) {
    if (ruleId.startsWith(`${category}-`)) {
      return category;
    }
  }

  // Fallback: split on first hyphen
  const parts = ruleId.split('-');
  if (parts.length >= 2) {
    return parts[0];
  }

  return null;
}
