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
import { trailingSlashRule } from './trailing-slash.js';
import type { LinkInfo } from '../../types.js';

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

// Regression: ISSUE-023 — technical-trailing-slash warned on pages that link each path one way
// Found by /qa on 2026-10-15
// Report: .gstack/qa-reports/run-20261015T075717Z/qa-report-developer-mozilla-org-2026-10-15.md
//
// developer.mozilla.org links its locale roots with a slash (/en-US/) and its
// documents without one, and 301s every variant to the form it links. The
// rule warned "4 URLs with slash, 441 without": link instances, including
// same-page #fragment links, with any mix across different paths counted as
// inconsistency. Two forms of the same path is what can split a URL in two.
describe('technical-trailing-slash (ISSUE-023)', () => {
  const PAGE = 'https://example.com/docs/page';
  const links = (...hrefs: string[]): LinkInfo[] =>
    hrefs.map((href) => ({ href: new URL(href, PAGE).href, text: 'x', isInternal: true, isNoFollow: false }));

  it('passes different paths that each use one form', async () => {
    const context = createTestContext('<html></html>', {
      url: PAGE,
      links: links('/en-US/', '/en-US/blog/', '/docs/a', '/docs/b', '/docs/a', `${PAGE}#top`),
    });
    const result = await trailingSlashRule.run(context);
    expect(result.status).toBe('pass');
    expect(result.details?.withSlashCount).toBe(2);
    expect(result.details?.withoutSlashCount).toBe(2);
  });

  it('warns when one path is linked both with and without the slash', async () => {
    const context = createTestContext('<html></html>', { url: PAGE, links: links('/about', '/about/', '/docs/a') });
    const result = await trailingSlashRule.run(context);
    expect(result.status).toBe('warn');
    expect(result.details?.conflictingPaths).toEqual(['/about']);
  });
});
