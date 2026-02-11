import type { CheerioAPI } from 'cheerio';

/**
 * Compare a specific element between raw and rendered DOM.
 * Returns null if rendered DOM is not available.
 */
export function compareDomElement(
  raw$: CheerioAPI,
  rendered$: CheerioAPI | undefined,
  selector: string
): { rawText: string; renderedText: string; differs: boolean } | null {
  if (!rendered$) return null;

  const rawText = raw$(selector).first().text().trim();
  const renderedText = rendered$(selector).first().text().trim();

  return {
    rawText,
    renderedText,
    differs: rawText !== renderedText,
  };
}

/**
 * Check if an element exists in rendered but not raw DOM (or vice versa).
 */
export function elementPresenceChanged(
  raw$: CheerioAPI,
  rendered$: CheerioAPI | undefined,
  selector: string
): { rawPresent: boolean; renderedPresent: boolean; changed: boolean } | null {
  if (!rendered$) return null;

  const rawPresent = raw$(selector).length > 0;
  const renderedPresent = rendered$(selector).length > 0;

  return {
    rawPresent,
    renderedPresent,
    changed: rawPresent !== renderedPresent,
  };
}

/**
 * Get element attribute from both DOMs.
 */
export function compareAttribute(
  raw$: CheerioAPI,
  rendered$: CheerioAPI | undefined,
  selector: string,
  attribute: string
): { rawValue: string | undefined; renderedValue: string | undefined; differs: boolean } | null {
  if (!rendered$) return null;

  const rawValue = raw$(selector).first().attr(attribute);
  const renderedValue = rendered$(selector).first().attr(attribute);

  return {
    rawValue,
    renderedValue,
    differs: rawValue !== renderedValue,
  };
}
