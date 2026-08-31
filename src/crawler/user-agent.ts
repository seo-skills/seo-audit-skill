/**
 * The User-Agent string sent by every request SEOmator makes.
 *
 * Centralised because requests originate from three places — the crawler, the
 * Playwright renderer, and rules that fetch robots.txt / sitemaps / URL
 * variants on their own. Those used to hardcode their own strings, so a single
 * audit identified itself under several different names and the configured
 * `crawler.user_agent` reached none of them.
 */

/** Identity used when the config does not override it */
export const DEFAULT_USER_AGENT =
  'SEOmatorBot/3.0 (+https://github.com/seo-skills/seo-audit-skill)';

/**
 * User-Agent for the mobile-parity render.
 *
 * Carries a real Android Chrome token so sites that serve different markup to
 * mobile (dynamic serving, UA sniffing) respond with their mobile version —
 * which is the version Google indexes mobile-first. The SEOmatorBot suffix
 * keeps it identifiable without hiding the mobile tokens sites look for.
 */
export const MOBILE_USER_AGENT =
  'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/120.0.0.0 Mobile Safari/537.36 SEOmatorBot/3.0 (+https://github.com/seo-skills/seo-audit-skill)';

let currentUserAgent = DEFAULT_USER_AGENT;

/**
 * Sets the User-Agent for all subsequent requests.
 * Called once during command startup from `crawler.user_agent`; a blank or
 * whitespace-only value restores the default rather than sending an empty header.
 *
 * @param userAgent - User-Agent string, or empty to use the default
 */
export function setUserAgent(userAgent: string | undefined | null): void {
  currentUserAgent = userAgent?.trim() || DEFAULT_USER_AGENT;
}

/**
 * Returns the User-Agent for outgoing requests.
 */
export function getUserAgent(): string {
  return currentUserAgent;
}

/**
 * Restores the default User-Agent (used by tests).
 */
export function resetUserAgent(): void {
  currentUserAgent = DEFAULT_USER_AGENT;
}
