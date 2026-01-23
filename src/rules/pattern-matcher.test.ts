import { describe, it, expect } from 'vitest';
import {
  matchesPattern,
  matchesAnyPattern,
  isRuleEnabled,
  filterRules,
  getRuleCategory,
} from './pattern-matcher.js';

describe('matchesPattern', () => {
  describe('exact matching', () => {
    it('should match exact rule ID', () => {
      expect(matchesPattern('meta-tags-title-present', 'meta-tags-title-present')).toBe(true);
    });

    it('should not match different rule ID', () => {
      expect(matchesPattern('meta-tags-title-present', 'meta-tags-title-length')).toBe(false);
    });
  });

  describe('wildcard matching', () => {
    it('should match all with *', () => {
      expect(matchesPattern('meta-tags-title-present', '*')).toBe(true);
      expect(matchesPattern('security-https', '*')).toBe(true);
      expect(matchesPattern('any-rule', '*')).toBe(true);
    });

    it('should match prefix with trailing *', () => {
      expect(matchesPattern('meta-tags-title-present', 'meta-tags-*')).toBe(true);
      expect(matchesPattern('meta-tags-title-length', 'meta-tags-*')).toBe(true);
      expect(matchesPattern('meta-tags-description-present', 'meta-tags-*')).toBe(true);
    });

    it('should not match non-matching prefix', () => {
      expect(matchesPattern('security-https', 'meta-tags-*')).toBe(false);
      expect(matchesPattern('links-broken', 'meta-tags-*')).toBe(false);
    });

    it('should match with * in the middle', () => {
      expect(matchesPattern('meta-tags-title-present', 'meta-*-present')).toBe(true);
      expect(matchesPattern('core-web-vitals-lcp', '*-lcp')).toBe(true);
    });

    it('should handle category shortcuts', () => {
      // Common use case: disable all CWV rules
      expect(matchesPattern('core-web-vitals-lcp', 'core-web-vitals-*')).toBe(true);
      expect(matchesPattern('core-web-vitals-cls', 'core-web-vitals-*')).toBe(true);
      expect(matchesPattern('core-web-vitals-fcp', 'core-web-vitals-*')).toBe(true);
    });
  });

  describe('special characters', () => {
    it('should handle dots in patterns', () => {
      // Dots should be literal, not regex wildcards
      expect(matchesPattern('rule.with.dots', 'rule.with.dots')).toBe(true);
      expect(matchesPattern('ruleXwithXdots', 'rule.with.dots')).toBe(false);
    });
  });
});

describe('matchesAnyPattern', () => {
  it('should return true if any pattern matches', () => {
    expect(matchesAnyPattern('meta-tags-title-present', ['meta-tags-*', 'links-*'])).toBe(true);
    expect(matchesAnyPattern('links-broken', ['meta-tags-*', 'links-*'])).toBe(true);
  });

  it('should return false if no pattern matches', () => {
    expect(matchesAnyPattern('security-https', ['meta-tags-*', 'links-*'])).toBe(false);
  });

  it('should handle empty patterns array', () => {
    expect(matchesAnyPattern('any-rule', [])).toBe(false);
  });
});

describe('isRuleEnabled', () => {
  describe('default behavior', () => {
    it('should enable all rules when no patterns specified', () => {
      expect(isRuleEnabled('any-rule', [], [])).toBe(true);
    });

    it('should enable all rules with * in enable list', () => {
      expect(isRuleEnabled('any-rule', ['*'], [])).toBe(true);
    });
  });

  describe('enable patterns', () => {
    it('should only enable matching rules when patterns specified', () => {
      const enable = ['meta-tags-*', 'links-*'];

      expect(isRuleEnabled('meta-tags-title-present', enable, [])).toBe(true);
      expect(isRuleEnabled('links-broken', enable, [])).toBe(true);
      expect(isRuleEnabled('security-https', enable, [])).toBe(false);
    });
  });

  describe('disable patterns', () => {
    it('should disable matching rules', () => {
      const disable = ['core-web-vitals-*'];

      expect(isRuleEnabled('meta-tags-title-present', ['*'], disable)).toBe(true);
      expect(isRuleEnabled('core-web-vitals-lcp', ['*'], disable)).toBe(false);
      expect(isRuleEnabled('core-web-vitals-cls', ['*'], disable)).toBe(false);
    });

    it('should disable even if enabled by enable pattern (precedence)', () => {
      const enable = ['*'];
      const disable = ['meta-tags-title-present'];

      expect(isRuleEnabled('meta-tags-title-present', enable, disable)).toBe(false);
      expect(isRuleEnabled('meta-tags-title-length', enable, disable)).toBe(true);
    });
  });

  describe('combined patterns', () => {
    it('should correctly handle enable and disable together', () => {
      const enable = ['meta-tags-*', 'links-*'];
      const disable = ['meta-tags-title-*'];

      // Enabled: meta-tags-* but not title-*
      expect(isRuleEnabled('meta-tags-description-present', enable, disable)).toBe(true);
      expect(isRuleEnabled('meta-tags-canonical-present', enable, disable)).toBe(true);

      // Disabled by disable pattern
      expect(isRuleEnabled('meta-tags-title-present', enable, disable)).toBe(false);
      expect(isRuleEnabled('meta-tags-title-length', enable, disable)).toBe(false);

      // Links should be enabled
      expect(isRuleEnabled('links-broken', enable, disable)).toBe(true);

      // Not in enable list
      expect(isRuleEnabled('security-https', enable, disable)).toBe(false);
    });
  });
});

describe('filterRules', () => {
  const allRules = [
    'meta-tags-title-present',
    'meta-tags-title-length',
    'meta-tags-description-present',
    'links-broken',
    'links-external-valid',
    'security-https',
    'security-hsts',
    'core-web-vitals-lcp',
    'core-web-vitals-cls',
  ];

  it('should return all rules when no filters', () => {
    const filtered = filterRules(allRules, [], []);
    expect(filtered).toEqual(allRules);
  });

  it('should filter to only enabled categories', () => {
    const filtered = filterRules(allRules, ['meta-tags-*'], []);
    expect(filtered).toEqual([
      'meta-tags-title-present',
      'meta-tags-title-length',
      'meta-tags-description-present',
    ]);
  });

  it('should exclude disabled rules', () => {
    const filtered = filterRules(allRules, ['*'], ['core-web-vitals-*']);
    expect(filtered).not.toContain('core-web-vitals-lcp');
    expect(filtered).not.toContain('core-web-vitals-cls');
    expect(filtered).toContain('meta-tags-title-present');
    expect(filtered).toContain('security-https');
  });

  it('should handle complex patterns', () => {
    const filtered = filterRules(allRules, ['*'], ['*-title-*', 'core-web-vitals-*']);

    expect(filtered).not.toContain('meta-tags-title-present');
    expect(filtered).not.toContain('meta-tags-title-length');
    expect(filtered).not.toContain('core-web-vitals-lcp');
    expect(filtered).toContain('meta-tags-description-present');
    expect(filtered).toContain('links-broken');
  });
});

describe('getRuleCategory', () => {
  it('should extract known categories', () => {
    expect(getRuleCategory('meta-tags-title-present')).toBe('meta-tags');
    expect(getRuleCategory('core-web-vitals-lcp')).toBe('core-web-vitals');
    expect(getRuleCategory('structured-data-present')).toBe('structured-data');
    expect(getRuleCategory('headings-h1-present')).toBe('headings');
    expect(getRuleCategory('technical-robots-txt')).toBe('technical');
    expect(getRuleCategory('links-broken')).toBe('links');
    expect(getRuleCategory('images-alt-present')).toBe('images');
    expect(getRuleCategory('security-https')).toBe('security');
    expect(getRuleCategory('social-og-title')).toBe('social');
  });

  it('should fallback to first segment for unknown categories', () => {
    expect(getRuleCategory('custom-some-rule')).toBe('custom');
  });

  it('should return null for invalid rule IDs', () => {
    expect(getRuleCategory('noruleid')).toBeNull();
  });
});
