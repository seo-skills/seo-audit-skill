// Static imports for all rule categories
// These modules self-register their rules when imported
import '../rules/core/index.js';
import '../rules/technical/index.js';
import '../rules/perf/index.js';
import '../rules/links/index.js';
import '../rules/images/index.js';
import '../rules/security/index.js';
import '../rules/schema/index.js';
import '../rules/social/index.js';
import '../rules/content/index.js';
import '../rules/a11y/index.js';
import '../rules/i18n/index.js';
import '../rules/crawl/index.js';
import '../rules/url/index.js';
import '../rules/mobile/index.js';
import '../rules/legal/index.js';
import '../rules/eeat/index.js';
import '../rules/redirect/index.js';
import '../rules/geo/index.js';
import '../rules/htmlval/index.js';
import '../rules/js/index.js';

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
  'core',
  'technical',
  'perf',
  'links',
  'images',
  'security',
  'schema',
  'social',
  'content',
  'a11y',
  'i18n',
  'crawl',
  'url',
  'mobile',
  'legal',
  'eeat',
  'redirect',
  'geo',
  'htmlval',
  'js',
] as const;
