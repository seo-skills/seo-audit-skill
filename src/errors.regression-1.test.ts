// Regression: ISSUE-028 — a refused connection was reported as code "unknown" with undici's "fetch failed"
// Found by /qa on 2026-10-15
// Report: .gstack/qa-reports/run-20261015T102121Z/qa-report-seomator-cli-skill-2026-10-15.md
//
// SKILL.md tells agents that a failed run exits 2 with a structured error and
// a stable `code` they can act on. Auditing a URL nothing listens on printed
// {"error":true,"code":"unknown","message":"fetch failed"} with no hint:
// classifyError knew DNS failures and timeouts, but a refused or reset
// connection, an unreachable host and a rejected TLS certificate all fell
// through to "unknown".
import { describe, it, expect } from 'vitest';
import { classifyError } from './errors.js';

/** The shape undici rejects with: a generic TypeError carrying the socket error as its cause */
function fetchFailed(code: string, message = `connect ${code} 127.0.0.1:1`): TypeError {
  return new TypeError('fetch failed', { cause: Object.assign(new Error(message), { code }) });
}

describe('classifyError for connection failures (ISSUE-028)', () => {
  it.each(['ECONNREFUSED', 'ECONNRESET', 'EHOSTUNREACH', 'ENETUNREACH'])(
    'classifies %s as unreachable, with a hint',
    (code) => {
      const error = classifyError(fetchFailed(code));
      expect(error.code).toBe('unreachable');
      expect(error.message).toContain(code);
      expect(error.hint).toBeTruthy();
    }
  );

  it.each(['DEPTH_ZERO_SELF_SIGNED_CERT', 'CERT_HAS_EXPIRED', 'ERR_TLS_CERT_ALTNAME_INVALID'])(
    'classifies the TLS failure %s as tls, with a hint',
    (code) => {
      const error = classifyError(fetchFailed(code, 'certificate rejected'));
      expect(error.code).toBe('tls');
      expect(error.hint).toBeTruthy();
    }
  );

  it('still classifies DNS failures and timeouts as before', () => {
    expect(classifyError(fetchFailed('ENOTFOUND', 'getaddrinfo ENOTFOUND nowhere.test')).code).toBe('dns');
    expect(classifyError(fetchFailed('UND_ERR_CONNECT_TIMEOUT', 'Connect Timeout Error')).code).toBe('timeout');
  });
});
