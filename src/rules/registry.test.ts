import { describe, it, expect, beforeEach } from 'vitest';
import {
  registerRule,
  getAllRules,
  getRulesByCategory,
  getRuleById,
  clearRegistry,
  getRuleCount,
} from './registry.js';
import type { AuditRule, AuditContext, RuleResult } from '../types.js';

// Helper to create mock rules
function createMockRule(
  id: string,
  category: string,
  name = 'Test Rule'
): AuditRule {
  return {
    id,
    name,
    description: `Test rule: ${id}`,
    category,
    weight: 10,
    run: (_context: AuditContext): RuleResult => ({
      ruleId: id,
      status: 'pass',
      message: 'Test passed',
      score: 100,
    }),
  };
}

describe('registry', () => {
  // Clear registry before each test to ensure isolation
  beforeEach(() => {
    clearRegistry();
  });

  describe('registerRule', () => {
    it('adds a rule to the registry', () => {
      const rule = createMockRule('test-rule-1', 'test-category');

      registerRule(rule);

      expect(getRuleCount()).toBe(1);
      expect(getRuleById('test-rule-1')).toBe(rule);
    });

    it('adds multiple rules to the registry', () => {
      const rule1 = createMockRule('rule-1', 'category-a');
      const rule2 = createMockRule('rule-2', 'category-b');
      const rule3 = createMockRule('rule-3', 'category-a');

      registerRule(rule1);
      registerRule(rule2);
      registerRule(rule3);

      expect(getRuleCount()).toBe(3);
    });

    it('throws error on duplicate rule ID', () => {
      const rule1 = createMockRule('duplicate-id', 'category-a');
      const rule2 = createMockRule('duplicate-id', 'category-b');

      registerRule(rule1);

      expect(() => registerRule(rule2)).toThrow(
        'Duplicate rule ID: "duplicate-id" is already registered'
      );
    });

    it('allows rules with different IDs but same category', () => {
      const rule1 = createMockRule('rule-1', 'same-category');
      const rule2 = createMockRule('rule-2', 'same-category');

      registerRule(rule1);
      registerRule(rule2);

      expect(getRuleCount()).toBe(2);
    });
  });

  describe('getAllRules', () => {
    it('returns empty array when no rules registered', () => {
      expect(getAllRules()).toEqual([]);
    });

    it('returns all registered rules', () => {
      const rule1 = createMockRule('rule-1', 'cat-a');
      const rule2 = createMockRule('rule-2', 'cat-b');
      const rule3 = createMockRule('rule-3', 'cat-c');

      registerRule(rule1);
      registerRule(rule2);
      registerRule(rule3);

      const allRules = getAllRules();

      expect(allRules).toHaveLength(3);
      expect(allRules).toContain(rule1);
      expect(allRules).toContain(rule2);
      expect(allRules).toContain(rule3);
    });

    it('returns a new array instance each time', () => {
      const rule = createMockRule('rule-1', 'cat-a');
      registerRule(rule);

      const result1 = getAllRules();
      const result2 = getAllRules();

      expect(result1).not.toBe(result2);
      expect(result1).toEqual(result2);
    });
  });

  describe('getRulesByCategory', () => {
    it('returns empty array for non-existent category', () => {
      const rule = createMockRule('rule-1', 'existing-category');
      registerRule(rule);

      expect(getRulesByCategory('non-existent')).toEqual([]);
    });

    it('returns only rules matching the category', () => {
      const rule1 = createMockRule('rule-1', 'target-category');
      const rule2 = createMockRule('rule-2', 'other-category');
      const rule3 = createMockRule('rule-3', 'target-category');
      const rule4 = createMockRule('rule-4', 'another-category');

      registerRule(rule1);
      registerRule(rule2);
      registerRule(rule3);
      registerRule(rule4);

      const targetRules = getRulesByCategory('target-category');

      expect(targetRules).toHaveLength(2);
      expect(targetRules).toContain(rule1);
      expect(targetRules).toContain(rule3);
      expect(targetRules).not.toContain(rule2);
      expect(targetRules).not.toContain(rule4);
    });

    it('returns empty array when registry is empty', () => {
      expect(getRulesByCategory('any-category')).toEqual([]);
    });

    it('is case-sensitive for category matching', () => {
      const rule1 = createMockRule('rule-1', 'Category');
      const rule2 = createMockRule('rule-2', 'category');

      registerRule(rule1);
      registerRule(rule2);

      expect(getRulesByCategory('Category')).toHaveLength(1);
      expect(getRulesByCategory('category')).toHaveLength(1);
      expect(getRulesByCategory('CATEGORY')).toHaveLength(0);
    });
  });

  describe('getRuleById', () => {
    it('returns undefined for non-existent rule', () => {
      expect(getRuleById('non-existent')).toBeUndefined();
    });

    it('returns the correct rule by ID', () => {
      const rule1 = createMockRule('find-me', 'cat-a');
      const rule2 = createMockRule('other-rule', 'cat-b');

      registerRule(rule1);
      registerRule(rule2);

      expect(getRuleById('find-me')).toBe(rule1);
      expect(getRuleById('other-rule')).toBe(rule2);
    });
  });

  describe('clearRegistry', () => {
    it('removes all rules from registry', () => {
      registerRule(createMockRule('rule-1', 'cat-a'));
      registerRule(createMockRule('rule-2', 'cat-b'));
      registerRule(createMockRule('rule-3', 'cat-c'));

      expect(getRuleCount()).toBe(3);

      clearRegistry();

      expect(getRuleCount()).toBe(0);
      expect(getAllRules()).toEqual([]);
    });

    it('allows re-registering rules after clear', () => {
      const rule = createMockRule('reusable-id', 'cat-a');

      registerRule(rule);
      clearRegistry();
      registerRule(rule);

      expect(getRuleCount()).toBe(1);
      expect(getRuleById('reusable-id')).toBe(rule);
    });
  });

  describe('getRuleCount', () => {
    it('returns 0 for empty registry', () => {
      expect(getRuleCount()).toBe(0);
    });

    it('returns correct count after adding rules', () => {
      registerRule(createMockRule('rule-1', 'cat-a'));
      expect(getRuleCount()).toBe(1);

      registerRule(createMockRule('rule-2', 'cat-b'));
      expect(getRuleCount()).toBe(2);

      registerRule(createMockRule('rule-3', 'cat-c'));
      expect(getRuleCount()).toBe(3);
    });

    it('returns 0 after clearing', () => {
      registerRule(createMockRule('rule-1', 'cat-a'));
      registerRule(createMockRule('rule-2', 'cat-b'));

      clearRegistry();

      expect(getRuleCount()).toBe(0);
    });
  });
});
