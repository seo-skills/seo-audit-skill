import { describe, it, expect } from 'vitest';
import { cookieFlagsRule, cookieLifetimeRule } from './cookie-flags.js';
import { parseSetCookie, cookieLifetimeDays } from '../../crawler/cookies.js';
import type { AuditContext, CookieInfo } from '../../types.js';
import * as cheerio from 'cheerio';

const HTML = '<html><body><p>Fixture</p></body></html>';

function createContext(cookies: CookieInfo[] | undefined, url = 'https://example.com/'): AuditContext {
  return {
    url,
    html: HTML,
    $: cheerio.load(HTML),
    headers: {},
    links: [],
    images: [],
    statusCode: 200,
    responseTime: 100,
    cwv: {},
    invalidLinks: [],
    specialLinks: [],
    figures: [],
    inlineSvgs: [],
    pictureElements: [],
    ...(cookies !== undefined && { cookies }),
  };
}

describe('parseSetCookie', () => {
  it('parses a name, flags and attributes', () => {
    const cookie = parseSetCookie('sid=abc123; Path=/; Secure; HttpOnly; SameSite=Lax');
    expect(cookie).toMatchObject({
      name: 'sid',
      secure: true,
      httpOnly: true,
      sameSite: 'Lax',
      path: '/',
    });
  });

  it('never retains the cookie value', () => {
    // Values are session tokens and audit output is shareable.
    const cookie = parseSetCookie('session=super-secret-token-value; Secure');
    expect(cookie?.valueLength).toBe('super-secret-token-value'.length);
    expect(JSON.stringify(cookie)).not.toContain('super-secret-token-value');
  });

  it('handles an Expires date containing a comma', () => {
    // The reason getSetCookie() matters: comma-joined headers are ambiguous
    // precisely because Expires dates contain a comma of their own.
    const cookie = parseSetCookie('a=1; Expires=Wed, 21 Oct 2026 07:28:00 GMT');
    expect(cookie?.name).toBe('a');
    expect(cookie?.expires).toBe('Wed, 21 Oct 2026 07:28:00 GMT');
  });

  it('returns null for a header with no name=value pair', () => {
    expect(parseSetCookie('Secure; HttpOnly')).toBeNull();
    expect(parseSetCookie('')).toBeNull();
  });

  it('ignores an unrecognised SameSite value', () => {
    expect(parseSetCookie('a=1; SameSite=Bogus')?.sameSite).toBeUndefined();
  });
});

describe('cookieLifetimeDays', () => {
  it('prefers Max-Age over Expires', () => {
    const cookie = parseSetCookie('a=1; Max-Age=86400; Expires=Wed, 21 Oct 2099 07:28:00 GMT')!;
    expect(cookieLifetimeDays(cookie)).toBe(1);
  });

  it('returns null for a session cookie', () => {
    expect(cookieLifetimeDays(parseSetCookie('a=1')!)).toBeNull();
  });
});

describe('cookieFlagsRule', () => {
  const cookie = (header: string) => parseSetCookie(header)!;

  it('passes when no cookies are set', async () => {
    const result = await cookieFlagsRule.run(createContext([]));
    expect(result.status).toBe('pass');
  });

  it('fails a session cookie without HttpOnly', async () => {
    const result = await cookieFlagsRule.run(
      createContext([cookie('sessionid=x; Secure; SameSite=Lax')])
    );
    expect(result.status).toBe('fail');
    expect(result.details?.missingHttpOnly).toEqual(['sessionid']);
  });

  it('does not treat a non-session cookie as an HttpOnly failure', async () => {
    // An analytics cookie readable by JS is expected, not a vulnerability.
    const result = await cookieFlagsRule.run(
      createContext([cookie('_ga=x; Secure; SameSite=Lax')])
    );
    expect(result.status).toBe('pass');
  });

  it('fails SameSite=None without Secure', async () => {
    const result = await cookieFlagsRule.run(createContext([cookie('pref=x; SameSite=None')]));
    expect(result.status).toBe('fail');
    expect(result.details?.invalidSameSiteNone).toEqual(['pref']);
  });

  it('does not demand Secure on an http page', async () => {
    // security-https is the real finding there; duplicating it adds noise.
    const result = await cookieFlagsRule.run(
      createContext([cookie('pref=x; SameSite=Lax')], 'http://example.com/')
    );
    expect(result.status).toBe('pass');
  });

  it('warns on a missing SameSite attribute', async () => {
    const result = await cookieFlagsRule.run(createContext([cookie('pref=x; Secure')]));
    expect(result.status).toBe('warn');
    expect(result.details?.missingSameSite).toEqual(['pref']);
  });

  it('reports as unmeasured when cookies were not captured', async () => {
    const result = await cookieFlagsRule.run(createContext(undefined));
    expect(result.weight).toBe(0);
  });
});

describe('cookieLifetimeRule', () => {
  it('warns beyond the 400-day browser cap', async () => {
    const tenYears = parseSetCookie('track=x; Max-Age=315360000')!;
    const result = await cookieLifetimeRule.run(createContext([tenYears]));
    expect(result.status).toBe('warn');
    expect(result.message).toContain('track');
  });

  it('passes a one-year cookie', async () => {
    const oneYear = parseSetCookie('pref=x; Max-Age=31536000')!;
    expect((await cookieLifetimeRule.run(createContext([oneYear]))).status).toBe('pass');
  });

  it('passes session cookies, which have no expiry', async () => {
    expect((await cookieLifetimeRule.run(createContext([parseSetCookie('a=1')!]))).status).toBe(
      'pass'
    );
  });
});
