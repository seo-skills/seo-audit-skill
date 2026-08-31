import type { AuditContext, CookieInfo } from '../../types.js';
import { defineRule, pass, warn, fail, notMeasured } from '../define-rule.js';
import { cookieLifetimeDays } from '../../crawler/cookies.js';

/**
 * Cookies whose names indicate they carry authentication or session state.
 *
 * These are the ones where a missing HttpOnly flag is exploitable: any XSS on
 * the site can read them and impersonate the visitor. A missing flag on an
 * analytics or preference cookie is untidy but not a session-theft risk.
 */
const SESSION_COOKIE_PATTERNS = [
  /sess/i,
  /^sid$/i,
  /auth/i,
  /token/i,
  /login/i,
  /csrf/i,
  /xsrf/i,
  /jwt/i,
  /^phpsessid$/i,
  /^asp\.net_sessionid$/i,
  /^jsessionid$/i,
  /remember/i,
];

function isSessionCookie(cookie: CookieInfo): boolean {
  return SESSION_COOKIE_PATTERNS.some((pattern) => pattern.test(cookie.name));
}

/** Chrome caps cookie lifetime at 400 days; anything beyond is silently trimmed. */
const MAX_USEFUL_LIFETIME_DAYS = 400;

function isHttps(url: string): boolean {
  try {
    return new URL(url).protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Rule: Cookie Security Flags
 *
 * Checks `Set-Cookie` response headers for the three flags that determine
 * whether a cookie can be stolen in transit, read by injected JavaScript, or
 * sent along with cross-site requests.
 *
 * Only server-set cookies are visible here. Cookies written by JavaScript via
 * `document.cookie` are not covered.
 */
export const cookieFlagsRule = defineRule({
  id: 'security-cookie-flags',
  name: 'Cookie Security Flags',
  description:
    'Checks Set-Cookie headers for Secure, HttpOnly and SameSite attributes on session cookies',
  category: 'security',
  weight: 10,
  run: (context: AuditContext) => {
    const cookies = context.cookies;

    if (cookies === undefined) {
      return notMeasured(
        'security-cookie-flags',
        'Response cookies not available - Set-Cookie headers are only captured on a live fetch'
      );
    }

    if (cookies.length === 0) {
      return pass('security-cookie-flags', 'No cookies set by the server on this response', {
        cookieCount: 0,
      });
    }

    const secureSite = isHttps(context.url);
    const sessionCookies = cookies.filter(isSessionCookie);

    // Secure only means anything on HTTPS; flagging it on an HTTP page would
    // duplicate security-https, which is the real finding there.
    const missingSecure = secureSite ? cookies.filter((c) => !c.secure) : [];
    const missingHttpOnly = sessionCookies.filter((c) => !c.httpOnly);
    const missingSameSite = cookies.filter((c) => c.sameSite === undefined);
    // SameSite=None without Secure is rejected outright by modern browsers.
    const invalidSameSiteNone = cookies.filter((c) => c.sameSite === 'None' && !c.secure);

    const details = {
      cookieCount: cookies.length,
      sessionCookieCount: sessionCookies.length,
      cookieNames: cookies.map((c) => c.name),
      missingSecure: missingSecure.map((c) => c.name),
      missingHttpOnly: missingHttpOnly.map((c) => c.name),
      missingSameSite: missingSameSite.map((c) => c.name),
      invalidSameSiteNone: invalidSameSiteNone.map((c) => c.name),
    };

    if (missingHttpOnly.length > 0) {
      return fail(
        'security-cookie-flags',
        `${missingHttpOnly.length} session cookie(s) missing HttpOnly: ${missingHttpOnly.map((c) => c.name).join(', ')}`,
        {
          ...details,
          impact:
            'A session cookie without HttpOnly can be read by any JavaScript on the page, so a single XSS becomes account takeover.',
        }
      );
    }

    if (invalidSameSiteNone.length > 0) {
      return fail(
        'security-cookie-flags',
        `${invalidSameSiteNone.length} cookie(s) use SameSite=None without Secure and will be rejected by browsers: ${invalidSameSiteNone.map((c) => c.name).join(', ')}`,
        details
      );
    }

    if (missingSecure.length > 0) {
      return warn(
        'security-cookie-flags',
        `${missingSecure.length} cookie(s) on an HTTPS page missing the Secure attribute: ${missingSecure.map((c) => c.name).join(', ')}`,
        details
      );
    }

    if (missingSameSite.length > 0) {
      return warn(
        'security-cookie-flags',
        `${missingSameSite.length} cookie(s) have no SameSite attribute: ${missingSameSite.map((c) => c.name).join(', ')}`,
        {
          ...details,
          note: 'Browsers default these to Lax, but setting it explicitly documents the intent and avoids relying on a default that has changed before.',
        }
      );
    }

    return pass(
      'security-cookie-flags',
      `All ${cookies.length} cookie(s) set appropriate security flags`,
      details
    );
  },
});

/**
 * Rule: Cookie Lifetime
 *
 * Flags cookies that outlive any plausible purpose. Chrome caps stored
 * lifetimes at 400 days, so a ten-year expiry is not honoured anyway, and
 * long-lived identifiers attract consent and retention obligations under
 * GDPR and ePrivacy.
 */
export const cookieLifetimeRule = defineRule({
  id: 'security-cookie-lifetime',
  name: 'Cookie Lifetime',
  description: 'Flags cookies with excessive expiry beyond the 400-day browser cap',
  category: 'security',
  weight: 4,
  run: (context: AuditContext) => {
    const cookies = context.cookies;

    if (cookies === undefined) {
      return notMeasured(
        'security-cookie-lifetime',
        'Response cookies not available - Set-Cookie headers are only captured on a live fetch'
      );
    }

    if (cookies.length === 0) {
      return pass('security-cookie-lifetime', 'No cookies set by the server on this response', {
        cookieCount: 0,
      });
    }

    const excessive: { name: string; days: number }[] = [];
    let sessionCookies = 0;

    for (const cookie of cookies) {
      const days = cookieLifetimeDays(cookie);
      if (days === null) {
        sessionCookies++;
        continue;
      }
      if (days > MAX_USEFUL_LIFETIME_DAYS) {
        excessive.push({ name: cookie.name, days: Math.round(days) });
      }
    }

    const details = {
      cookieCount: cookies.length,
      sessionCookieCount: sessionCookies,
      excessiveLifetime: excessive,
      capDays: MAX_USEFUL_LIFETIME_DAYS,
    };

    if (excessive.length > 0) {
      const worst = excessive.reduce((a, b) => (a.days > b.days ? a : b));
      return warn(
        'security-cookie-lifetime',
        `${excessive.length} cookie(s) set a lifetime beyond the 400-day browser cap (longest: ${worst.name} at ${worst.days} days)`,
        {
          ...details,
          note: 'Chrome trims stored lifetimes to 400 days, so the excess has no effect while still signalling long-term tracking intent to auditors.',
        }
      );
    }

    return pass(
      'security-cookie-lifetime',
      `All ${cookies.length} cookie(s) use a reasonable lifetime`,
      details
    );
  },
});
