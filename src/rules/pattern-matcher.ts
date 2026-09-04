import { getCategoryIds } from '../categories/index.js';

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
 * The category a rule id belongs to.
 *
 * Derived from the real category list rather than a hardcoded one. The list
 * this used to carry — `meta-tags`, `core-web-vitals`, `structured-data`,
 * `headings` — described a taxonomy this codebase does not have, and its own
 * test asserted that taxonomy, so it passed while being wrong about every
 * rule the product actually ships.
 *
 * @param ruleId - Rule identifier (e.g. `core-title-present`)
 * @returns The category id, or null if the rule id matches no category
 */
export function getRuleCategory(ruleId: string): string | null {
  // `perf` is the one category whose rules do not all share its name: the five
  // Core Web Vitals rules are `cwv-*`. A `perf-*` pattern therefore does not
  // reach them, which is worth knowing before writing `disable = ["perf-*"]`.
  if (ruleId.startsWith('cwv-')) {
    return 'perf';
  }

  // Longest match first, so a category id that prefixes another cannot shadow it.
  const match = getCategoryIds()
    .filter((id) => ruleId.startsWith(`${id}-`))
    .sort((a, b) => b.length - a.length)[0];

  return match ?? null;
}

