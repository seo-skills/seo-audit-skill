import type { CheerioAPI } from 'cheerio';

/**
 * Represents a typed item extracted from JSON-LD
 */
export interface TypedItem {
  /** The @type value (e.g., 'Article', 'Product') */
  type: string;
  /** The raw data object */
  data: Record<string, unknown>;
  /** Field names present in the item (excluding @-prefixed fields) */
  fields: string[];
}

/**
 * Extract all JSON-LD scripts from page
 * Parses each script and returns valid JSON objects
 * Skips empty or invalid JSON scripts
 */
export function extractJsonLdScripts($: CheerioAPI): unknown[] {
  const results: unknown[] = [];
  const jsonLdScripts = $('script[type="application/ld+json"]');

  jsonLdScripts.each((_, element) => {
    const rawContent = $(element).html() || '';
    const trimmedContent = rawContent.trim();

    if (!trimmedContent) {
      return;
    }

    try {
      const parsed = JSON.parse(trimmedContent);
      results.push(parsed);
    } catch {
      // Skip invalid JSON - handled by valid.ts rule
    }
  });

  return results;
}

/**
 * Extract all items with @type from JSON-LD data
 * Handles @graph arrays and nested objects recursively
 */
export function extractTypedItems(data: unknown): TypedItem[] {
  const items: TypedItem[] = [];

  if (!data || typeof data !== 'object') {
    return items;
  }

  // Handle arrays (including top-level arrays)
  if (Array.isArray(data)) {
    for (const item of data) {
      items.push(...extractTypedItems(item));
    }
    return items;
  }

  const obj = data as Record<string, unknown>;

  // Check @graph array (common in WordPress and other CMSes)
  if (Array.isArray(obj['@graph'])) {
    for (const graphItem of obj['@graph']) {
      items.push(...extractTypedItems(graphItem));
    }
  }

  // Check direct @type
  if (obj['@type']) {
    const types = Array.isArray(obj['@type'])
      ? (obj['@type'] as string[])
      : [obj['@type'] as string];

    const fields = Object.keys(obj).filter((k) => !k.startsWith('@'));

    for (const type of types) {
      items.push({
        type,
        data: obj,
        fields,
      });
    }
  }

  // Recursively check nested objects (but not @graph which we already handled)
  for (const [key, value] of Object.entries(obj)) {
    if (key === '@graph') continue;
    if (value && typeof value === 'object') {
      items.push(...extractTypedItems(value));
    }
  }

  return items;
}

/**
 * Find all items of a specific type (or types) in JSON-LD scripts
 */
export function findItemsByType(
  $: CheerioAPI,
  targetTypes: string | string[]
): TypedItem[] {
  const targets = Array.isArray(targetTypes) ? targetTypes : [targetTypes];
  const allItems: TypedItem[] = [];

  const scripts = extractJsonLdScripts($);
  for (const script of scripts) {
    allItems.push(...extractTypedItems(script));
  }

  return allItems.filter((item) => targets.includes(item.type));
}

/**
 * Check if a field exists and is not empty
 * Handles null, undefined, empty string, and empty arrays
 */
export function hasField(item: TypedItem, field: string): boolean {
  const value = item.data[field];

  if (value === null || value === undefined) {
    return false;
  }

  if (typeof value === 'string') {
    return value.trim().length > 0;
  }

  if (Array.isArray(value)) {
    return value.length > 0;
  }

  // Objects and other truthy values
  return true;
}

/**
 * Get missing fields from a required list
 * Returns field names that fail the hasField check
 */
export function getMissingFields(item: TypedItem, required: string[]): string[] {
  return required.filter((field) => !hasField(item, field));
}
