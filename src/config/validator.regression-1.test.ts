// Regression: ISSUE-004 — a misspelled CI gate key passed validation and the gate never fired
// Found by /qa on 2026-11-18
// Report: .gstack/qa-reports/run-20261118T115906Z/qa-report-seomator-cli-2026-11-18.md
//
// `[rules.override]` refuses a key it does not know, because a typo there is a
// fail_ci gate that never fires. `[ci]` and the `[[custom.*]]` entries carry the
// same gates and accepted any key: `failunder = 95` or `failci = true` validated
// as fine and did nothing.
import { describe, it, expect } from 'vitest';
import { validateConfig } from './validator.js';
import type { PartialSeomatorConfig } from './schema.js';

const errorAt = (config: unknown, path: string) =>
  validateConfig(config as PartialSeomatorConfig).errors.find((error) => error.path === path);

describe('config keys that carry a CI gate', () => {
  it('refuses a misspelled [ci] key and names the one meant', () => {
    const error = errorAt({ ci: { failunder: 95 } }, 'ci.failunder');
    expect(error?.message).toMatch(/unknown key "failunder"/);
    expect(error?.message).toMatch(/fail_under/);
  });

  it('refuses a misspelled key in a custom search and in a custom extract', () => {
    const custom = {
      search: [{ name: 'analytics', text: 'gtag(', failci: true }],
      extract: [{ name: 'sku', selector: '.sku', multipel: true }],
    };
    const result = validateConfig({ custom } as unknown as PartialSeomatorConfig);
    const search = result.errors.find((error) => /failci/.test(error.message));
    const extract = result.errors.find((error) => /multipel/.test(error.message));
    expect(search?.message).toMatch(/fail_ci/);
    expect(extract?.message).toMatch(/multiple/);
    expect(result.valid).toBe(false);
  });

  it('accepts every documented key', () => {
    const config = {
      ci: { fail_under: 80, min_coverage: 90 },
      custom: {
        search: [{ name: 's', where: 'text', text: 'x', match: 'literal', expect: 'present', severity: 'fail', fail_ci: true, scope: '/blog/' }],
        extract: [{ name: 'e', selector: 'h1', attribute: 'id', multiple: true }],
      },
    };
    const result = validateConfig(config as unknown as PartialSeomatorConfig);
    expect(result.errors.filter((error) => /unknown key/.test(error.message))).toEqual([]);
  });
});
