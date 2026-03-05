/**
 * Re-export fix suggestions for use in the renderer.
 *
 * We inline a subset here because the full fix-suggestions.ts file
 * lives in src/ and uses Node.js module resolution. In a future
 * optimization we could share it via the preload bridge, but for
 * now the renderer imports this lightweight proxy.
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
