/**
 * Fix suggestions for the renderer — OFFLINE FALLBACK only.
 *
 * The primary path is `RuleMetadata.fix`: the main process attaches fix
 * text from src/reporters/fix-suggestions.ts to every rule's metadata when an
 * audit completes (audit-bridge) or is loaded from history (db-bridge).
 * RuleCard prefers `metadata.fix` and only calls this map when metadata is
 * absent, so this stays empty unless the preload bridge ever preloads it.
 */

const FIX_SUGGESTIONS: Record<string, string> = {};

let loaded = false;

/**
 * Get fix suggestion for a rule.
 * Falls back to a generic message if the rule ID is not found.
 */
export function getFixSuggestion(ruleId: string): string {
  return FIX_SUGGESTIONS[ruleId] || 'Review and fix this issue based on SEO best practices.';
}

/**
 * Register fix suggestions from the main process.
 * Called once during app initialization via IPC.
 */
export function registerFixSuggestions(suggestions: Record<string, string>): void {
  if (!loaded) {
    Object.assign(FIX_SUGGESTIONS, suggestions);
    loaded = true;
  }
}
