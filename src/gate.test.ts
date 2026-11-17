import { describe, it, expect } from 'vitest';
import './rules/loader.js';
import { evaluateGate, describeGateFailure, findFilteredGates, gatedRuleIds } from './gate.js';
import type { AuditResult, RuleResult } from './types.js';

function result(score: number, results: RuleResult[]): AuditResult {
  return {
    url: 'https://example.com/',
    overallScore: score,
    timestamp: '2026-11-17T00:00:00.000Z',
    crawledPages: 1,
    categoryResults: [
      { categoryId: 'core', score, passCount: 0, warnCount: 0, failCount: 0, results },
    ],
  };
}

const canonical = (status: RuleResult['status'], page = 'https://example.com/', weight?: number): RuleResult => ({
  ruleId: 'core-canonical-present',
  status,
  message: status === 'fail' ? 'No canonical' : 'Canonical present',
  score: status === 'pass' ? 100 : 0,
  details: { pageUrl: page },
  ...(weight !== undefined && { weight }),
});

const gated = { 'core-canonical-present': { fail_ci: true } };

describe('the score threshold', () => {
  it.each([
    [69, 1],
    [70, 0],
    [71, 0],
  ])('score %i against fail-under 70 exits %i', (score, exit) => {
    expect(evaluateGate(result(score, []), { failUnder: 70 }).exitCode).toBe(exit);
  });

  it('fail-under 0 never fails on score', () => {
    expect(evaluateGate(result(0, []), { failUnder: 0 }).exitCode).toBe(0);
  });
});

describe('fail_ci rules', () => {
  it('a failure on any page exits 1 even when the score passes, and names the pages', () => {
    const gate = evaluateGate(
      result(85, [
        canonical('pass', 'https://example.com/a'),
        canonical('fail', 'https://example.com/b'),
        canonical('fail', 'https://example.com/c'),
      ]),
      { failUnder: 70, overrides: gated }
    );
    expect(gate.exitCode).toBe(1);
    expect(gate.failedCiRules).toEqual([
      { ruleId: 'core-canonical-present', pages: ['https://example.com/b', 'https://example.com/c'] },
    ]);
    expect(gate.reason).toBe('core-canonical-present failed on 2 pages (fail_ci); score 85 passed fail-under 70');
  });

  it('a warning never trips the gate', () => {
    const gate = evaluateGate(result(85, [canonical('warn')]), { failUnder: 70, overrides: gated });
    expect(gate.exitCode).toBe(0);
    expect(gate.reason).toBeUndefined();
  });

  it('a gated rule that was never measured exits 1 instead of passing silently', () => {
    const gate = evaluateGate(
      result(90, [{ ...canonical('not-measured'), message: 'needs a browser render', weight: 0 }]),
      { failUnder: 70, overrides: gated }
    );
    expect(gate.exitCode).toBe(1);
    expect(gate.unevaluated).toEqual([{ ruleId: 'core-canonical-present', reason: 'needs a browser render' }]);
    expect(gate.reason).toContain('was not measured (needs a browser render)');
  });

  it('a gated rule with no result at all exits 1', () => {
    const gate = evaluateGate(result(90, []), { failUnder: 70, overrides: gated });
    expect(gate.unevaluated).toEqual([{ ruleId: 'core-canonical-present', reason: 'the rule did not run' }]);
    expect(gate.exitCode).toBe(1);
  });

  it('a priority-only override does not gate', () => {
    expect(gatedRuleIds({ 'core-canonical-present': { priority: 'low' } })).toEqual([]);
    const gate = evaluateGate(result(85, [canonical('fail')]), {
      failUnder: 70,
      overrides: { 'core-canonical-present': { priority: 'ignore' } },
    });
    expect(gate.exitCode).toBe(0);
  });

  it('ignore plus fail_ci hides the finding but still gates CI', () => {
    const gate = evaluateGate(result(85, [canonical('fail')]), {
      failUnder: 70,
      overrides: { 'core-canonical-present': { priority: 'ignore', fail_ci: true } },
    });
    expect(gate.exitCode).toBe(1);
  });
});

describe('the exit line', () => {
  it('says the score failed when it did', () => {
    expect(
      describeGateFailure({ failUnder: 70, score: 50, failedCiRules: [], unevaluated: [], exitCode: 1 })
    ).toBe('score 50 is below fail-under 70');
  });
});

describe('gated rules a filter removes', () => {
  it('reports a gated rule turned off by rules.disable', () => {
    expect(
      findFilteredGates(gated, { categories: [], enableRules: ['*'], disableRules: ['core-canonical-*'] })
    ).toEqual([expect.stringContaining('turned off by [rules] enable/disable')]);
  });

  it('reports a gated rule outside the selected categories', () => {
    expect(findFilteredGates(gated, { categories: ['perf'], enableRules: ['*'], disableRules: [] })).toEqual([
      expect.stringContaining('category "core", which --categories leaves out'),
    ]);
  });

  it('is quiet when the gated rule runs', () => {
    expect(findFilteredGates(gated, { categories: ['core'], enableRules: ['*'], disableRules: [] })).toEqual([]);
  });
});
