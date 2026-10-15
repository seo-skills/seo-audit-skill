// Regression: ISSUE-029 — crawl-indexability-conflict merged every robots.txt group instead of reading Googlebot's
// Found by /qa on 2026-10-15
// Report: .gstack/qa-reports/run-20261015T102121Z/qa-report-seomator-cli-skill-2026-10-15.md
//
// A crawler obeys only the most specific group naming it. The rule pooled the
// Disallow lines of every `*`, googlebot and bingbot group, so with a
// Googlebot group that permits /others-only/ and a `*` group that blocks it,
// it warned "Page blocked by robots.txt" while the 6.0.0 score cap, reading
// Googlebot's group, correctly left the same page uncapped. It also downloaded
// robots.txt again although the audit had already fetched it.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createTestContext } from '../test-context.js';
import { indexabilityConflictRule } from './indexability-conflict.js';
import { RobotsMatcher } from '../../crawler/robots.js';

const ROBOTS = `User-agent: Googlebot
Disallow: /gonly/

User-agent: *
Disallow: /others-only/
`;

function context(path: string) {
  return createTestContext('<html><head><title>T</title></head><body></body></html>', {
    url: `https://site.test${path}`,
    robotsTxtContent: ROBOTS,
  });
}

afterEach(() => vi.unstubAllGlobals());

describe('crawl-indexability-conflict robots.txt group (ISSUE-029)', () => {
  it('reads the Googlebot group, as search engines and the score cap do', async () => {
    const fetchSpy = vi.fn(async () => {
      throw new Error('robots.txt is already in the context');
    });
    vi.stubGlobal('fetch', fetchSpy);

    const allowed = await indexabilityConflictRule.run(context('/others-only/page'));
    expect(allowed.status).toBe('pass');
    expect(allowed.details?.robotsTxtStatus).toBe('accessible');

    const blocked = await indexabilityConflictRule.run(context('/gonly/page'));
    expect(blocked.status).toBe('warn');
    expect(blocked.message).toContain('/gonly/');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('RobotsMatcher.explain names the rule that decided', () => {
    const matcher = new RobotsMatcher(ROBOTS, 'Googlebot');
    expect(matcher.explain('https://site.test/gonly/x')).toEqual({ allowed: false, pattern: '/gonly/' });
    expect(matcher.explain('https://site.test/others-only/x')).toEqual({ allowed: true, pattern: null });
    expect(matcher.isAllowed('https://site.test/gonly/x')).toBe(false);
  });
});
