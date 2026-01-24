// Static imports for all rule categories
// These modules self-register their rules when imported
import '../rules/core-seo/index.js';
import '../rules/meta-tags/index.js';
import '../rules/headings/index.js';
import '../rules/technical/index.js';
import '../rules/core-web-vitals/index.js';
import '../rules/links/index.js';
import '../rules/images/index.js';
import '../rules/security/index.js';
import '../rules/structured-data/index.js';
import '../rules/social/index.js';
import '../rules/content/index.js';

let rulesLoaded = false;

/**
 * Ensures all rule category modules are loaded
 * With static imports, rules are loaded at module initialization
 * This function exists for API compatibility
 * @returns Promise that resolves immediately (rules already loaded)
 */
export async function loadAllRules(): Promise<void> {
  // Rules are loaded via static imports above
  // This function ensures idempotent behavior
  if (rulesLoaded) {
    return;
  }
  rulesLoaded = true;
}

/**
 * List of all rule category names
 * Useful for debugging or introspection
 */
export const CATEGORY_MODULES = [
  'core-seo',
  'meta-tags',
  'headings',
  'technical',
  'core-web-vitals',
  'links',
  'images',
  'security',
  'structured-data',
  'social',
  'content',
] as const;
