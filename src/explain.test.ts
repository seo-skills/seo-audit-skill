import { describe, it, expect, afterEach, vi } from 'vitest';
import './rules/loader.js';
import { explainRule, formatExplanation, listRuleIds } from './explain.js';
import { runExplain } from './commands/explain.js';
import { getRuleCount } from './rules/registry.js';

afterEach(() => {
  vi.restoreAllMocks();
  process.exitCode = undefined;
});

describe('explainRule', () => {
  it('explains a known rule with its weight, fix and a paste-ready override', () => {
    const explanation = explainRule('core-canonical-present');
    if ('unknown' in explanation) throw new Error('expected a rule');
    expect(explanation.category).toBe('core');
    expect(explanation.fix).toContain('canonical');
    expect(explanation.overrideExample).toContain('"core-canonical-present" = { priority = "low" }');
    const text = formatExplanation(explanation);
    expect(text).toContain('core-canonical-present: ');
    expect(text).toContain('Weight: ');
  });

  it('suggests the closest ids for an unknown one', () => {
    expect(explainRule('core-canonical-presnt')).toEqual({
      unknown: 'core-canonical-presnt',
      suggestions: ['core-canonical-present'],
    });
  });

  it('lists every rule, or one category', () => {
    expect(listRuleIds()).toHaveLength(getRuleCount());
    const security = listRuleIds('security');
    expect(security.length).toBeGreaterThan(0);
    expect(security.every((r) => r.category === 'security')).toBe(true);
  });
});

describe('seomator explain', () => {
  it('exits 2 with the suggestion for an unknown id', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    await runExplain('core-canonical-presnt', {});
    expect(process.exitCode).toBe(2);
    expect(err.mock.calls.flat().join(' ')).toContain('core-canonical-present');
  });

  it('prints JSON with --json', async () => {
    const out: string[] = [];
    vi.spyOn(console, 'log').mockImplementation((s) => void out.push(String(s)));
    await runExplain('url-underscores', { json: true });
    expect(JSON.parse(out.join('\n')).id).toBe('url-underscores');
  });
});
