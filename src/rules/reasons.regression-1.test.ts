// Regression: ISSUE-002 — 40 checks that cannot run on a single page gave no reason
// Found by /qa on 2026-11-18
// Report: .gstack/qa-reports/run-20261118T115906Z/qa-report-seomator-cli-2026-11-18.md
//
// A check that takes no reading says why: it needs a browser render, there was
// nothing to check, and so on. The cross-page checks said "run with --crawl" in
// their message but carried no reason, so MCP and the dashboard reported them as
// "could not verify", and the duplicate checks called a missing crawl "did not
// apply", which let a fail_ci gate on them pass a single-page run unmeasured.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { Auditor } from '../auditor.js';
import { evaluateGate } from '../gate.js';
import type { AuditResult } from '../types.js';

const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Reasons fixture page</title>
<meta name="description" content="A page for checking that every unmeasured check says why it took no reading.">
<link rel="canonical" href="https://site.test/"></head>
<body><h1>Reasons</h1><p>${'Words on the page. '.repeat(80)}</p><a href="/a">a</a></body></html>`;

afterEach(() => vi.unstubAllGlobals());

async function singlePageAudit(): Promise<AuditResult> {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const path = new URL(String(input instanceof Request ? input.url : input)).pathname;
      return path === '/'
        ? new Response(PAGE, { headers: { 'content-type': 'text/html; charset=utf-8' } })
        : new Response('', { status: 404 });
    })
  );
  return new Auditor({ measureCwv: false }).audit('https://site.test/');
}

describe('a single-page audit', () => {
  it('gives every check that took no reading a reason', async () => {
    const result = await singlePageAudit();
    const reasonless = result.categoryResults
      .flatMap((category) => category.results)
      .filter((r) => r.status === 'not-measured' && !r.reason)
      .map((r) => r.ruleId);
    expect(reasonless).toEqual([]);
  });

  it('says the cross-page checks need a crawl', async () => {
    const result = await singlePageAudit();
    const byRule = new Map(result.categoryResults.flatMap((c) => c.results).map((r) => [r.ruleId, r.reason]));
    for (const ruleId of ['links-orphan-pages', 'content-duplicate-exact', 'core-title-unique', 'schema-entity-conflict']) {
      expect(byRule.get(ruleId), ruleId).toBe('needs-crawl');
    }
  });

  it('does not let a fail_ci gate on a crawl-only check pass unmeasured', async () => {
    const result = await singlePageAudit();
    const gate = evaluateGate(result, { failUnder: 0, overrides: { 'content-duplicate-exact': { fail_ci: true } } });
    expect(gate.exitCode).toBe(1);
    expect(gate.unevaluated.map((u) => u.ruleId)).toContain('content-duplicate-exact');
  });
});
