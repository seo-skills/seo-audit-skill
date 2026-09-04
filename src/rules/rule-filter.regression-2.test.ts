// Regression: ISSUE-006 (part 2) — [rules] enable/disable now actually filter
// Found by /qa on 2026-09-04, wired the same day
// Report: .gstack/qa-reports/qa-report-cli-config-2026-09-04b.md
//
// The first pass made the ignored filter loud rather than silent, because
// applying it changes the score and that needed the run profile to carry it.
// This is the wiring: the auditor filters rules, a category left with no rules
// is dropped instead of scored, and the patterns reach `AuditRunOptions` so
// `compare` reports a filtered run as not like-for-like.
//
// The dropped-category rule is the important one. calculateCategoryScore([])
// returns 0, so keeping an emptied category would report a narrower audit as a
// catastrophic one — a filtered score of 41 for a site that got 88.
import { describe, it, expect, vi, afterEach } from 'vitest';
import * as cheerio from 'cheerio';
import { createAuditor } from '../index.js';
import { calculateCategoryScore } from '../scoring.js';

const PAGE_URL = 'https://example.test/';
const HTML = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Filter Fixture</title>
<meta name="description" content="Fixture for the rule filter regression test.">
<link rel="canonical" href="${PAGE_URL}">
<meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body><h1>Filter Fixture</h1><p>Body text.</p></body></html>`;

function stubFetch() {
  return vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url === PAGE_URL) {
      return new Response(HTML, {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' },
      });
    }
    return new Response('', { status: 404 });
  });
}

/** Run an audit over several categories with the given filter. */
async function auditWith(enableRules: string[], disableRules: string[] = []) {
  vi.stubGlobal('fetch', stubFetch());
  const auditor = createAuditor({
    categories: ['core', 'security', 'links', 'perf'],
    measureCwv: false,
    enableRules,
    disableRules,
  });
  const result = await auditor.audit(PAGE_URL);
  return {
    result,
    categoryIds: result.categoryResults.map((c) => c.categoryId),
    ruleCount: result.categoryResults.reduce((n, c) => n + c.results.length, 0),
  };
}

afterEach(() => vi.unstubAllGlobals());

describe('the rule filter actually removes rules', () => {
  it('runs everything on the default enable = ["*"]', async () => {
    const { ruleCount, categoryIds } = await auditWith(['*']);
    expect(ruleCount).toBeGreaterThan(50);
    expect(categoryIds).toContain('perf');
  });

  it('runs fewer rules when enable names a subset', async () => {
    const all = await auditWith(['*']);
    const narrowed = await auditWith(['security-*']);

    expect(narrowed.ruleCount).toBeGreaterThan(0);
    expect(narrowed.ruleCount).toBeLessThan(all.ruleCount);
  });

  it('drops rules that disable matches, with disable beating enable', async () => {
    const all = await auditWith(['*']);
    const without = await auditWith(['*'], ['security-*']);

    expect(without.ruleCount).toBeLessThan(all.ruleCount);
    expect(without.categoryIds).not.toContain('security');
  });
});

describe('a category left with no rules is dropped, not scored zero', () => {
  it('an emptied category returns 0 from the scorer, which is why it is dropped', () => {
    // The reason this rule exists, asserted directly.
    expect(calculateCategoryScore([])).toBe(0);
  });

  it('removes the category from the result rather than scoring it', async () => {
    const { categoryIds } = await auditWith(['*'], ['security-*']);
    expect(categoryIds).not.toContain('security');
    expect(categoryIds).toContain('core');
  });

  it('does not drag the overall score down when a category is filtered out', async () => {
    const all = await auditWith(['*']);
    const filtered = await auditWith(['*'], ['security-*']);

    // Scoring an emptied category as 0 would sink this. The overall score
    // renormalises over the categories that ran, so it stays in range.
    expect(filtered.result.overallScore).toBeGreaterThan(
      all.result.overallScore - 40
    );
  });

  it('keeps only the categories asked for when enable is narrow', async () => {
    const { categoryIds } = await auditWith(['security-*', 'links-*']);
    expect([...categoryIds].sort()).toEqual(['links', 'security']);
  });
});

describe('the run records the filter, so compare cannot be fooled', () => {
  it('carries the patterns on the audit result', async () => {
    const { result } = await auditWith(['security-*'], ['security-https']);

    expect(result.run?.enableRules).toEqual(['security-*']);
    expect(result.run?.disableRules).toEqual(['security-https']);
  });

  it('reports a filter change as a material run difference', async () => {
    const { compareRunProfiles, hasMaterialDifference } = await import(
      '../storage/audits-db/run-profile.js'
    );
    const base = await auditWith(['*']);
    const narrowed = await auditWith(['security-*']);

    const differences = compareRunProfiles(base.result.run, narrowed.result.run);

    // Without this, `compare --fail-on-regression` would fail a build whose
    // only change was a line in seomator.toml.
    expect(differences.length).toBeGreaterThan(0);
    expect(hasMaterialDifference(differences)).toBe(true);
  });
});
