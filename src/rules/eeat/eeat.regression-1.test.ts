// Regression: ISSUE-018 — eeat-citations counted footer links to the publisher as sources
// Found by /qa on 2026-10-15
// Report: .gstack/qa-reports/run-20261015T075717Z/qa-report-developer-mozilla-org-2026-10-15.md
//
// developer.mozilla.org scored "Strong citation profile: 9 authoritative
// sources cited". All 9 were footer or social links: eight to mozilla.org,
// the publisher's own parent site, and one to bsky.app, matched by /\.org$/
// because the pattern was tested against the whole href
// (bsky.app/profile/developer.mozilla.org). The article cites no outside source.
import { describe, it, expect } from 'vitest';
import { createTestContext } from '../test-context.js';
import { citationsRule } from './citations.js';

const PAGE = 'https://developer.mozilla.org/en-US/docs/Web/HTML';

describe('eeat-citations (ISSUE-018)', () => {
  it('does not count footer links, the publisher\'s own domains, or a domain in a URL path', async () => {
    const html = `<html><body><main><p>Body text without sources.</p></main>
      <footer>
        <a href="https://www.mozilla.org/about/">Mozilla</a>
        <a href="https://www.mozilla.org/privacy/websites/">Privacy</a>
        <a href="https://foundation.mozilla.org/">Foundation</a>
      </footer>
      <p><a href="https://bsky.app/profile/developer.mozilla.org">Bluesky</a></p>
    </body></html>`;
    const result = await citationsRule.run(createTestContext(html, { url: PAGE }));
    expect(result.details?.citationCount ?? 0).toBe(0);
  });

  it('still counts authoritative sources cited in the content', async () => {
    const html = `<html><body><main><p>See
      <a href="https://www.w3.org/TR/html52/">the W3C spec</a>,
      <a href="https://www.nih.gov/research">NIH</a> and
      <a href="https://arxiv.org/abs/1234.5678">this paper</a>.</p></main></body></html>`;
    const result = await citationsRule.run(createTestContext(html, { url: PAGE }));
    expect(result.status).toBe('pass');
    expect(result.details?.citationCount).toBe(3);
  });
});
