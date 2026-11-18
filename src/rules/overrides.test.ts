import { describe, it, expect } from 'vitest';
import './loader.js';
import { applyRuleOverrides, collectIgnoredFindings, overridePriorityFactor } from './overrides.js';
import { collectFindings } from '../reporters/findings.js';
import { renderMarkdownReport } from '../reporters/markdown-reporter.js';
import { renderLlmReport } from '../reporters/llm-reporter.js';
import type { AuditResult } from '../types.js';

function audit(): AuditResult {
  return {
    url: 'https://example.com/',
    overallScore: 80,
    timestamp: '2026-11-17T00:00:00.000Z',
    crawledPages: 1,
    categoryResults: [
      {
        categoryId: 'core',
        score: 50,
        passCount: 0,
        warnCount: 1,
        failCount: 1,
        results: [
          { ruleId: 'core-description-present', status: 'fail', message: 'No description', score: 0, weight: 8 },
          { ruleId: 'core-canonical-present', status: 'warn', message: 'Canonical is relative', score: 50, weight: 8 },
        ],
      },
    ],
  };
}

describe('applyRuleOverrides', () => {
  it('marks only the overridden rule and leaves status, score and weight alone', () => {
    const result = applyRuleOverrides(audit(), { 'core-description-present': { priority: 'low', fail_ci: true } });
    const [description, canonical] = result.categoryResults[0].results;
    expect(description.overridden).toEqual({ priority: 'low', failCi: true });
    expect(description.status).toBe('fail');
    expect(description.score).toBe(0);
    expect(description.weight).toBe(8);
    expect(canonical.overridden).toBeUndefined();
    expect(result.overallScore).toBe(80);
  });

  it('leaves an audit untouched when there is nothing to override', () => {
    expect(applyRuleOverrides(audit(), {})).toEqual(audit());
    expect(applyRuleOverrides(audit(), undefined)).toEqual(audit());
  });
});

describe('ranking and hiding', () => {
  it('scales priority by the override', () => {
    expect(overridePriorityFactor('high')).toBeGreaterThan(overridePriorityFactor(undefined));
    expect(overridePriorityFactor('low')).toBeLessThan(1);
    expect(overridePriorityFactor('ignore')).toBe(0);
  });

  it('a low override lowers a finding below an unoverridden one of equal weight', () => {
    const base = collectFindings(audit());
    const lowered = collectFindings(
      applyRuleOverrides(audit(), { 'core-description-present': { priority: 'low' } })
    );
    const before = base.find((f) => f.ruleId === 'core-description-present')!.priority;
    const after = lowered.find((f) => f.ruleId === 'core-description-present')!.priority;
    expect(after).toBeLessThan(before);
  });

  it('ignore hides the finding from reports and lists it as ignored', () => {
    const result = applyRuleOverrides(audit(), { 'core-description-present': { priority: 'ignore' } });
    expect(collectFindings(result).map((f) => f.ruleId)).toEqual(['core-canonical-present']);
    expect(collectIgnoredFindings(result)).toEqual([
      { ruleId: 'core-description-present', count: 1, status: 'fail' },
    ]);
    expect(renderMarkdownReport(result)).toContain('Ignored by config (1)');
    expect(renderLlmReport(result)).toContain('<ignored-by-config>core-description-present</ignored-by-config>');
  });

  it('keeps ignored results in the JSON shape with their mark', () => {
    const result = applyRuleOverrides(audit(), { 'core-description-present': { priority: 'ignore' } });
    const json = JSON.parse(JSON.stringify(result)) as AuditResult;
    expect(json.categoryResults[0].results[0].overridden).toEqual({ priority: 'ignore' });
  });
});
