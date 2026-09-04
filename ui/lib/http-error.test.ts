/**
 * An error must never describe itself as nothing.
 *
 * `HttpApiError` took the response body's `error` field and called
 * `super(failure.message)`. When the body was not the exact envelope this
 * client expects — a bare string, a proxy's HTML 502, an empty body — that
 * field was `undefined`, so the error carried the message `''`. Every caller
 * tests `if (error)`, and an empty string is falsy, so a failed read walked
 * through every error branch untouched and rendered as an empty database: the
 * dashboard told the user they had no audits and invited them to run their
 * first one, while the ones they had sat unread.
 */
import { describe, it, expect } from 'vitest';
import { HttpApiError } from './http-api.js';

describe('HttpApiError', () => {
  it('uses the message when the envelope is well formed', () => {
    const e = new HttpApiError(500, { code: 'db_locked', message: 'The database is locked.' });
    expect(e.message).toBe('The database is locked.');
    expect(e.code).toBe('db_locked');
  });

  it.each([
    ['undefined failure', undefined],
    ['null failure', null],
    ['empty object', {}],
    ['blank message', { message: '   ' }],
    ['non-string message', { message: 42 as unknown as string }],
  ])('still says something for %s', (_label, failure) => {
    const e = new HttpApiError(503, failure as never);
    expect(e.message.trim()).not.toBe('');
    expect(Boolean(e.message)).toBe(true); // the property that actually mattered
    expect(e.message).toContain('503');
  });

  it('falls back to a known code rather than undefined', () => {
    expect(new HttpApiError(500, undefined).code).toBe('unknown');
  });

  it('is truthy in the check every caller performs', () => {
    // The regression in one line.
    const message = new HttpApiError(502, undefined).message;
    expect(message ? 'handled' : 'silently ignored').toBe('handled');
  });
});

/**
 * A restarted `seomator serve` mints a new per-launch token. A tab that was
 * already open still holds the old cookie, so every API call 401s while the
 * document request would happily set the new one. That distinction decides
 * which action the UI can offer: retrying the same fetch repeats the same 401
 * forever, and only a reload picks up a fresh cookie.
 */
describe('a stale session is not a generic read failure', () => {
  it('is identifiable by status, not by message', () => {
    const stale = new HttpApiError(401, { code: 'unauthorized', message: 'Bad token' });
    expect(stale.status).toBe(401);
  });

  it('is distinguishable from the failures that Retry can fix', () => {
    const retryable = [500, 502, 503].map((s) => new HttpApiError(s, undefined));
    for (const error of retryable) {
      expect(error.status).not.toBe(401);
    }
  });

  it('still carries a message a person can read', () => {
    expect(new HttpApiError(401, undefined).message).toContain('401');
  });
});
