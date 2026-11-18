import { describe, it, expect } from 'vitest';
import { validateConfig } from './validator.js';
import { editDistance, suggestClosest, didYouMean } from './suggest.js';
import { getDefaultConfig } from './defaults.js';

const RULE_IDS = ['core-canonical-present', 'core-description-present', 'url-underscores'];

describe('did you mean', () => {
  it('measures edits', () => {
    expect(editDistance('kitten', 'sitting')).toBe(3);
    expect(editDistance('', 'abc')).toBe(3);
    expect(editDistance('same', 'same')).toBe(0);
  });

  it('suggests the closest id and nothing far away', () => {
    expect(suggestClosest('core-canonical-presnt', RULE_IDS)).toEqual(['core-canonical-present']);
    expect(suggestClosest('canonical-present', RULE_IDS)).toEqual(['core-canonical-present']);
    expect(suggestClosest('zzzzzz', RULE_IDS)).toEqual([]);
  });

  it('phrases one or several suggestions', () => {
    expect(didYouMean('url-underscore', RULE_IDS)).toBe(' Did you mean "url-underscores"?');
    expect(didYouMean('zzzzzz', RULE_IDS)).toBe('');
  });
});

describe('[rules.override] validation', () => {
  const withOverride = (override: Record<string, unknown>) => ({
    rules: { enable: ['*'], disable: [], override },
  });

  it('accepts priority and fail_ci on known rules', () => {
    const result = validateConfig(
      withOverride({
        'core-description-present': { priority: 'low' },
        'url-underscores': { priority: 'ignore' },
        'core-canonical-present': { fail_ci: true },
      }) as never,
      { ruleIds: RULE_IDS }
    );
    expect(result.errors).toEqual([]);
  });

  it('rejects an unknown rule id with a suggestion, so a gate cannot silently turn off', () => {
    const result = validateConfig(withOverride({ 'core-canonical-presnt': { fail_ci: true } }) as never, {
      ruleIds: RULE_IDS,
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0].message).toContain('unknown rule id "core-canonical-presnt"');
    expect(result.errors[0].message).toContain('Did you mean "core-canonical-present"?');
  });

  it('rejects an unknown key, a bad priority and a non-boolean fail_ci', () => {
    const result = validateConfig(
      withOverride({
        'core-canonical-present': { fail_cl: true },
        'url-underscores': { priority: 'urgent' },
        'core-description-present': { fail_ci: 'yes' },
      }) as never,
      { ruleIds: RULE_IDS }
    );
    const messages = result.errors.map((e) => e.message).join('\n');
    expect(messages).toContain('unknown override key "fail_cl". Did you mean "fail_ci"?');
    expect(messages).toContain('priority must be one of: high, normal, low, ignore');
    expect(messages).toContain('fail_ci must be true or false');
  });

  it('does not check ids when the caller has no registry', () => {
    expect(validateConfig(withOverride({ anything: { priority: 'low' } }) as never).errors).toEqual([]);
  });

  it('checks [ci] fail_under', () => {
    expect(validateConfig({ ci: { fail_under: 101 } }).errors[0].path).toBe('ci.fail_under');
    expect(validateConfig({ ci: { fail_under: 70 } }).errors).toEqual([]);
  });

  it('accepts the default config', () => {
    expect(validateConfig(getDefaultConfig(), { ruleIds: RULE_IDS }).errors).toEqual([]);
  });
});
