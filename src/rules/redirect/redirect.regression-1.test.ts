// Regression: ISSUE-004 — a case-normalizing 301 read as a loop, a non-redirect, and a missing redirect
// Found by /qa on 2026-10-15
// Report: .gstack/qa-reports/run-20261015T075717Z/qa-report-developer-mozilla-org-2026-10-15.md
//
// Auditing https://developer.mozilla.org/en-us/docs/web/html records the chain
// [/en-us/docs/web/html 301, /en-US/docs/Web/HTML 200]: exactly the
// case-normalization redirect SEO advice asks for. redirect-loop lowercased
// whole URLs, so the two hops looked identical and it failed "Redirect loop
// detected" (weight 15). redirect-type read the final status, 200, and said
// "Page is not a redirect". redirect-case-normalization compared the
// requested URL with the canonical and asked for the redirect already there.
import { describe, it, expect } from 'vitest';
import { createTestContext } from '../test-context.js';
import { redirectLoopRule } from './loop.js';
import { redirectTypeRule } from './type.js';
import { caseNormalizationRule } from './case-normalization.js';

const REQUESTED = 'https://developer.mozilla.org/en-us/docs/web/html';
const CANONICAL = 'https://developer.mozilla.org/en-US/docs/Web/HTML';
const HTML = `<html><head><link rel="canonical" href="${CANONICAL}"></head><body></body></html>`;

function context(chain: { url: string; statusCode: number }[]) {
  return createTestContext(HTML, { url: REQUESTED, redirectChain: chain });
}

const CASE_REDIRECT = [
  { url: REQUESTED, statusCode: 301 },
  { url: CANONICAL, statusCode: 200 },
];

describe('redirect rules on a case-normalizing redirect (ISSUE-004)', () => {
  it('redirect-loop treats paths as case-sensitive', async () => {
    expect((await redirectLoopRule.run(context(CASE_REDIRECT))).status).toBe('pass');
  });

  it('redirect-loop still catches a real loop, and a host that differs only in case', async () => {
    const loop = [
      { url: 'https://example.com/a', statusCode: 301 },
      { url: 'https://EXAMPLE.com/b', statusCode: 302 },
      { url: 'https://example.com/a', statusCode: 301 },
    ];
    expect((await redirectLoopRule.run(context(loop))).status).toBe('fail');
    const hostCase = [
      { url: 'https://EXAMPLE.com/a', statusCode: 301 },
      { url: 'https://example.com/a', statusCode: 200 },
    ];
    expect((await redirectLoopRule.run(context(hostCase))).status).toBe('fail');
  });

  it('redirect-type grades the 301 hop in the chain', async () => {
    const result = await redirectTypeRule.run(context(CASE_REDIRECT));
    expect(result.status).toBe('pass');
    expect(result.message).toMatch(/301/);
  });

  it('redirect-type warns on a temporary hop', async () => {
    const result = await redirectTypeRule.run(
      context([
        { url: REQUESTED, statusCode: 302 },
        { url: CANONICAL, statusCode: 200 },
      ])
    );
    expect(result.status).toBe('warn');
  });

  it('redirect-type is not measured when no chain was recorded', async () => {
    const result = await redirectTypeRule.run(createTestContext(HTML, { url: CANONICAL }));
    expect(result.status).toBe('not-measured');
  });

  it('redirect-case-normalization passes when the case variant redirects to the canonical', async () => {
    expect((await caseNormalizationRule.run(context(CASE_REDIRECT))).status).toBe('pass');
  });

  it('redirect-case-normalization still warns when a case variant is served without a redirect', async () => {
    const result = await caseNormalizationRule.run(context([{ url: REQUESTED, statusCode: 200 }]));
    expect(result.status).toBe('warn');
  });
});
