// Regression: ISSUE-017 — security-csp asked for directives the policy already covers
// Found by /qa on 2026-10-15
// Report: .gstack/qa-reports/run-20261015T075717Z/qa-report-developer-mozilla-org-2026-10-15.md
//
// developer.mozilla.org sends X-Frame-Options: DENY, and security-csp warned
// that its CSP lacks frame-ancestors, though both block framing and
// security-x-frame-options accepts either. The rule would also call
// script-src, style-src and img-src "missing" from a policy whose
// default-src covers them: those directives fall back to default-src.
import { describe, it, expect } from 'vitest';
import { createTestContext } from '../test-context.js';
import { cspRule } from './csp.js';

const run = (headers: Record<string, string>) => cspRule.run(createTestContext('<html></html>', { headers }));

describe('security-csp recommended directives (ISSUE-017)', () => {
  it('accepts X-Frame-Options in place of frame-ancestors', async () => {
    const result = await run({
      'content-security-policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'",
      'x-frame-options': 'DENY',
    });
    expect(result.status).toBe('pass');
  });

  it('counts default-src as covering the fetch directives', async () => {
    const result = await run({ 'content-security-policy': "default-src 'self'; frame-ancestors 'none'" });
    expect(result.status).toBe('pass');
  });

  it('still asks for frame-ancestors when nothing else blocks framing', async () => {
    const result = await run({ 'content-security-policy': "default-src 'self'" });
    expect(result.status).toBe('warn');
    expect(result.details?.missingRecommended).toEqual(['frame-ancestors']);
  });

  it('still lists the fetch directives when there is no default-src', async () => {
    const result = await run({ 'content-security-policy': "script-src 'self'", 'x-frame-options': 'SAMEORIGIN' });
    expect(result.details?.missingRecommended).toEqual(['default-src', 'style-src', 'img-src']);
  });
});
