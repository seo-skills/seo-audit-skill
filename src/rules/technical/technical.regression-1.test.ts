// Regression: ISSUE-022 — technical-www-redirect called an unreachable host a redirect
// Found by /qa on 2026-10-15
// Report: .gstack/qa-reports/run-20261015T075717Z/qa-report-developer-mozilla-org-2026-10-15.md
//
// www.developer.mozilla.org does not resolve. The rule reported "Only
// non-www version is directly accessible (redirect likely in place)", but a
// status of 0 means no answer at all; fetchUrl follows redirects, so a host
// that redirects answers with the target's status. The pass is right (a
// host that does not respond cannot serve a duplicate); the reason was not.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createTestContext } from '../test-context.js';
import { wwwRedirectRule } from './www-redirect.js';

afterEach(() => vi.unstubAllGlobals());

describe('technical-www-redirect with an unreachable variant (ISSUE-022)', () => {
  it('says the www host does not respond instead of guessing at a redirect', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.includes('://www.')) throw new TypeError('getaddrinfo ENOTFOUND');
        return new Response(null, { status: 200 });
      })
    );
    const result = await wwwRedirectRule.run(
      createTestContext('<html></html>', { url: 'https://developer.mozilla.org/en-US/' })
    );
    expect(result.status).toBe('pass');
    expect(result.message).not.toMatch(/redirect likely/);
    expect(result.message).toMatch(/www\.developer\.mozilla\.org does not respond/);
  });
});
