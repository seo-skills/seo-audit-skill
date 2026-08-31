import type { CookieInfo } from '../types.js';

/**
 * Parses `Set-Cookie` response headers.
 *
 * Cookie values are deliberately never retained. Audit results travel into
 * shareable HTML reports and into the LLM reporter's output, and a session
 * token in one of those is a worse outcome than not auditing cookies at all.
 * Only the name, attributes and value length are kept.
 */

/** Normalise a SameSite value to its canonical spelling */
function parseSameSite(value: string): CookieInfo['sameSite'] {
  switch (value.trim().toLowerCase()) {
    case 'strict':
      return 'Strict';
    case 'lax':
      return 'Lax';
    case 'none':
      return 'None';
    default:
      return undefined;
  }
}

/**
 * Parse one `Set-Cookie` header value.
 *
 * @param header - Raw header value, e.g. `sid=abc; Path=/; Secure; HttpOnly`
 * @returns Parsed cookie, or null if the header has no `name=value` pair
 */
export function parseSetCookie(header: string): CookieInfo | null {
  const segments = header.split(';');
  const pair = segments[0] ?? '';
  const eq = pair.indexOf('=');
  if (eq < 1) return null;

  const name = pair.slice(0, eq).trim();
  if (!name) return null;

  const cookie: CookieInfo = {
    name,
    valueLength: pair.slice(eq + 1).trim().length,
    secure: false,
    httpOnly: false,
  };

  for (const segment of segments.slice(1)) {
    const trimmed = segment.trim();
    const attrEq = trimmed.indexOf('=');
    const attrName = (attrEq === -1 ? trimmed : trimmed.slice(0, attrEq)).toLowerCase();
    const attrValue = attrEq === -1 ? '' : trimmed.slice(attrEq + 1).trim();

    switch (attrName) {
      case 'secure':
        cookie.secure = true;
        break;
      case 'httponly':
        cookie.httpOnly = true;
        break;
      case 'samesite':
        cookie.sameSite = parseSameSite(attrValue);
        break;
      case 'domain':
        cookie.domain = attrValue;
        break;
      case 'path':
        cookie.path = attrValue;
        break;
      case 'expires':
        cookie.expires = attrValue;
        break;
      case 'max-age': {
        const maxAge = Number.parseInt(attrValue, 10);
        if (!Number.isNaN(maxAge)) cookie.maxAge = maxAge;
        break;
      }
    }
  }

  return cookie;
}

/**
 * Parse every `Set-Cookie` header from a response.
 *
 * @param headers - The response's headers
 * @returns One entry per cookie the server set
 */
export function parseSetCookieHeaders(headers: Headers): CookieInfo[] {
  // getSetCookie preserves each header separately. Reading `set-cookie` via
  // get() comma-joins them, which is ambiguous because Expires dates contain
  // commas of their own.
  const raw =
    typeof headers.getSetCookie === 'function'
      ? headers.getSetCookie()
      : ([] as string[]);

  const cookies: CookieInfo[] = [];
  for (const header of raw) {
    const cookie = parseSetCookie(header);
    if (cookie) cookies.push(cookie);
  }
  return cookies;
}

/**
 * Effective lifetime of a cookie in days, or null when it is a session cookie.
 *
 * Max-Age wins over Expires when both are present, per RFC 6265.
 *
 * @param cookie - The cookie to measure
 * @param now - Reference time, for deterministic testing
 */
export function cookieLifetimeDays(cookie: CookieInfo, now = Date.now()): number | null {
  if (cookie.maxAge !== undefined) {
    return cookie.maxAge / 86400;
  }
  if (cookie.expires) {
    const expiry = Date.parse(cookie.expires);
    if (Number.isNaN(expiry)) return null;
    return (expiry - now) / 86400000;
  }
  return null;
}
