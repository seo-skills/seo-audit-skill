// Regression: ISSUE-006 — [rules] enable/disable are documented and inert
// Found by /qa on 2026-09-04
// Report: .gstack/qa-reports/qa-report-127-0-0-1-2026-09-04.md
//
// `docs/configuration.md` documents `rules.enable` and `rules.disable` with a
// table and worked examples, and `seomator config` prints whatever the file
// says. Nothing applies them: `isRuleEnabled()` and `filterRules()` are
// exported from `src/rules/pattern-matcher.ts`, are covered by their own
// tests, and have no caller outside those tests. A config asking for three
// categories was measured against all 332 rules, with no output saying so.
//
// `--preset ci` made it worse by shipping `enable = ["meta-tags/*", ...]`:
// `meta-tags` is not a category here and `/` is not the separator, so the list
// matched zero rules even in principle.
//
// Until something applies the filter, the contract this asserts is that the
// tool says so rather than staying quiet.
import { describe, it, expect } from 'vitest';
import { validateConfig, selectsRuleSubset } from './validator.js';
import { getDefaultConfig } from './defaults.js';
import { getPresetConfig } from './writer.js';
import { isRuleEnabled } from '../rules/pattern-matcher.js';

describe('selectsRuleSubset only fires on a real request', () => {
  it('is quiet for the default enable = ["*"]', () => {
    expect(selectsRuleSubset({ enable: ['*'], disable: [] })).toBe(false);
  });

  it('is quiet for an empty enable, which also means all rules', () => {
    // isRuleEnabled() treats [] as "no restriction"; warning here would fire
    // on configs that asked for nothing.
    expect(isRuleEnabled('core-title-present', [], [])).toBe(true);
    expect(selectsRuleSubset({ enable: [], disable: [] })).toBe(false);
  });

  it('is quiet for a missing section', () => {
    expect(selectsRuleSubset(undefined)).toBe(false);
    expect(selectsRuleSubset({})).toBe(false);
  });

  it('fires when enable names a subset', () => {
    expect(selectsRuleSubset({ enable: ['security-*'], disable: [] })).toBe(true);
  });

  it('fires when disable names anything, even alongside enable = ["*"]', () => {
    // The documented example is exactly this shape.
    expect(selectsRuleSubset({ enable: ['*'], disable: ['perf-*'] })).toBe(true);
  });
});

describe('a config that asks for a rule subset is told it will not get one', () => {
  it('warns rather than accepting it silently', () => {
    const config = getDefaultConfig();
    config.rules = { enable: ['*'], disable: ['perf-*', 'a11y-color-contrast'] };

    const result = validateConfig(config);

    // Not an error: the file stays valid and the audit still runs.
    expect(result.valid).toBe(true);
    const warning = result.warnings.find((w) => w.path === 'rules');
    expect(warning, 'an unapplied rule filter must produce a warning').toBeDefined();
    expect(warning?.message).toMatch(/not applied/i);
  });

  it('stays quiet on a default config, so the warning means something', () => {
    const result = validateConfig(getDefaultConfig());
    expect(result.warnings.find((w) => w.path === 'rules')).toBeUndefined();
  });
});

describe('the ci preset does not ship a filter it cannot honour', () => {
  const ci = getPresetConfig('ci');

  it('writes no [rules] section', () => {
    expect(selectsRuleSubset(ci.rules)).toBe(false);
  });

  it('would have matched zero real rules anyway', () => {
    // The shipped patterns, against real ids from four categories. `/` is not
    // the separator and `meta-tags` is not a category in this codebase.
    const shipped = ['meta-tags/*', 'security/*', 'links/*'];
    const realIds = [
      'core-title-present',
      'security-https',
      'links-broken-internal',
      'perf-lcp',
    ];
    for (const id of realIds) {
      expect(isRuleEnabled(id, shipped, []), `${id} should not match`).toBe(false);
    }
    // The correct spelling does match, which is what makes the above a typo
    // rather than an intentionally empty selection.
    expect(isRuleEnabled('security-https', ['security-*'], [])).toBe(true);
  });
});
