/**
 * Rule infrastructure exports
 */

// Rule definition helpers
export { defineRule, pass, warn, fail } from './define-rule.js';

// Rule registry
export {
  registerRule,
  getAllRules,
  getRulesByCategory,
  getRuleById,
  clearRegistry,
  getRuleCount,
} from './registry.js';

// Rule loader
export { loadAllRules, CATEGORY_MODULES } from './loader.js';

// Pattern matcher for enable/disable rules
export {
  matchesPattern,
  matchesAnyPattern,
  isRuleEnabled,
  filterRules,
  getRuleCategory,
} from './pattern-matcher.js';
