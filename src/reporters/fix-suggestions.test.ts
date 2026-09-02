// Regression: ISSUE-005 — FIX_SUGGESTIONS covered all 332 rules, but nothing
// held it there. getFixSuggestion() falls back to a generic string, so rule
// 333 would ship with "Review and fix this issue based on SEO best practices"
// in the HTML and LLM reports and no test would notice.
// Found by /qa on 2026-09-02
// Report: .gstack/qa-reports/qa-report-audit-cli-2026-09-02.md
import { describe, it, expect } from 'vitest';
import { FIX_SUGGESTIONS, getFixSuggestion } from './fix-suggestions.js';
import { getAllRules } from '../rules/registry.js';
import '../rules/loader.js';

const rules = getAllRules();
const suggestionIds = new Set(Object.keys(FIX_SUGGESTIONS));

describe('fix suggestion coverage', () => {
  it('registers rules to check against', () => {
    expect(rules.length).toBeGreaterThan(300);
  });

  it('has a suggestion for every registered rule', () => {
    const missing = rules.map((r) => r.id).filter((id) => !suggestionIds.has(id));
    expect(missing).toEqual([]);
  });

  it('has no suggestion keyed to a rule that no longer exists', () => {
    const ruleIds = new Set(rules.map((r) => r.id));
    const orphans = [...suggestionIds].filter((id) => !ruleIds.has(id));
    expect(orphans).toEqual([]);
  });

  it('never falls back to the generic string for a registered rule', () => {
    const generic = getFixSuggestion('a-rule-that-does-not-exist');
    const fallenBack = rules.filter((r) => getFixSuggestion(r.id) === generic);
    expect(fallenBack.map((r) => r.id)).toEqual([]);
  });

  it('gives every suggestion enough text to act on', () => {
    const tooShort = Object.entries(FIX_SUGGESTIONS)
      .filter(([, text]) => text.trim().length < 20)
      .map(([id]) => id);
    expect(tooShort).toEqual([]);
  });

  it('still falls back for an unknown rule id', () => {
    expect(getFixSuggestion('not-a-rule')).toMatch(/SEO best practices/);
  });
});
