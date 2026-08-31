import type { AuditRule } from '../types.js';

/**
 * Internal registry storing all audit rules by their ID
 */
const rules: Map<string, AuditRule> = new Map();

/**
 * Registers an audit rule in the registry
 * @param rule - The rule to register
 * @throws Error if a rule with the same ID is already registered
 */
export function registerRule(rule: AuditRule): void {
  if (rules.has(rule.id)) {
    throw new Error(
      `Duplicate rule ID: "${rule.id}" is already registered. ` +
        `Each rule must have a unique identifier.`
    );
  }
  rules.set(rule.id, rule);
}

/**
 * Retrieves all registered rules
 * @returns Array of all registered audit rules
 */
export function getAllRules(): AuditRule[] {
  return Array.from(rules.values());
}

/**
 * Retrieves all rules belonging to a specific category
 * @param categoryId - The category identifier to filter by
 * @returns Array of rules in the specified category
 */
export function getRulesByCategory(categoryId: string): AuditRule[] {
  return Array.from(rules.values()).filter(
    (rule) => rule.category === categoryId
  );
}

/**
 * Retrieves a specific rule by ID
 * @param ruleId - The rule identifier
 * @returns The rule if found, undefined otherwise
 */
export function getRuleById(ruleId: string): AuditRule | undefined {
  return rules.get(ruleId);
}

/**
 * Clears all registered rules (useful for testing)
 */
export function clearRegistry(): void {
  rules.clear();
}

/**
 * Reset callbacks for rules that accumulate state across pages.
 *
 * Deliberately not cleared by clearRegistry(): ESM caches modules after first
 * import, so a cleared set would never repopulate and the resets would silently
 * stop running for the rest of the process.
 */
const resettables: Set<() => void> = new Set();

/**
 * Registers a reset callback for a rule that holds cross-page state.
 *
 * Rules that answer cross-page questions (duplicate titles, near-duplicate
 * content) accumulate a module-level registry as pages stream through. That
 * state must be discarded between audits or the next audit compares its pages
 * against the previous one's.
 *
 * @param reset - Callback that clears the rule's accumulated state
 */
export function registerResettable(reset: () => void): void {
  resettables.add(reset);
}

/**
 * Clears accumulated cross-page state for every stateful rule.
 * Called at the start of each audit run.
 */
export function resetCrossPageState(): void {
  for (const reset of resettables) {
    reset();
  }
}

/**
 * Gets the number of registered reset callbacks (for testing)
 */
export function getResettableCount(): number {
  return resettables.size;
}

/**
 * Gets the total count of registered rules
 * @returns Number of rules in the registry
 */
export function getRuleCount(): number {
  return rules.size;
}
