import { describe, it, expect } from 'vitest';
import { agentLine, formatPoints, nextGrade, nextGradeLine, rankedFixes, splitFix, tied, type Fix } from './fixes.js';
import type { AuditResult } from '../../src/types.js';

function result(rules: Array<{ ruleId: string; status: string; points?: number; priority?: number; advisory?: boolean }>, extra: Partial<AuditResult> = {}): AuditResult {
  return {
    url: 'https://example.com',
    overallScore: 90,
    timestamp: '2026-11-18T00:00:00Z',
    crawledPages: 1,
    categoryResults: [
      {
        categoryId: 'perf',
        score: 80,
        passCount: 0,
        warnCount: 0,
        failCount: 0,
        results: rules.map((r) => ({ message: '', score: 0, ...r })) as AuditResult['categoryResults'][number]['results'],
      },
    ],
    ...extra,
  } as AuditResult;
}

const fix = (points: number): Fix => ({ points } as Fix);

describe('splitFix', () => {
  it('makes the text before a colon or semicolon the headline', () => {
    expect(splitFix('Reduce DOM size: remove unused elements, use virtualization for long lists')).toEqual({
      headline: 'Reduce DOM size',
      rest: 'Remove unused elements, use virtualization for long lists',
    });
    expect(splitFix('Remove loading="lazy" from above-fold images; add fetchpriority="high"')).toEqual({
      headline: 'Remove loading="lazy" from above-fold images',
      rest: 'Add fetchpriority="high"',
    });
  });

  it('keeps a fix with no separator whole and drops a trailing full stop', () => {
    expect(splitFix('Add width and height attributes to prevent layout shifts.')).toEqual({
      headline: 'Add width and height attributes to prevent layout shifts',
      rest: '',
    });
  });

  it('does not split on a colon inside a value', () => {
    // "4.5:1" has no space after the colon
    expect(splitFix('Ensure text has minimum 4.5:1 contrast ratio against background').rest).toBe('');
  });
});

describe('rankedFixes', () => {
  it('ranks by points across failures and warnings, not failures first', () => {
    const fixes = rankedFixes(
      result([
        { ruleId: 'narrow-fail', status: 'fail', points: 0.3 },
        { ruleId: 'heavy-warn', status: 'warn', points: 0.4 },
        { ruleId: 'passing', status: 'pass', points: 0 },
        { ruleId: 'unmeasured', status: 'not-measured', points: 0 },
        { ruleId: 'advisory-fail', status: 'fail', points: 0, advisory: true },
      ]),
      undefined
    );
    expect(fixes.map((f) => f.ruleId)).toEqual(['heavy-warn', 'narrow-fail']);
  });

  it('falls back to priority when a payload carries no points', () => {
    const fixes = rankedFixes(
      result([
        { ruleId: 'a', status: 'warn', priority: 10 },
        { ruleId: 'b', status: 'fail', priority: 40 },
      ]),
      undefined
    );
    expect(fixes.map((f) => f.ruleId)).toEqual(['b', 'a']);
  });
});

describe('formatPoints and tied', () => {
  it('prints one decimal, and never "+0.0" for a fix worth something', () => {
    expect(formatPoints(0.57)).toBe('+0.6');
    expect(formatPoints(0.02)).toBe('+<0.1');
    expect(formatPoints(0)).toBe('+0.0');
  });

  it('calls two fixes tied when they print the same', () => {
    expect(tied(fix(0.571), fix(0.568))).toBe(true);
    expect(tied(fix(0.57), fix(0.43))).toBe(false);
    expect(tied(fix(0.57), undefined)).toBe(false);
  });
});

describe('agentLine', () => {
  const page = result([]);

  it('says what the first five return of what is missing', () => {
    // The 2026-11-18 seomator.com audit: 0.57, 0.57, 0.43, 0.43, 0.38, then more
    const fixes = [0.57, 0.57, 0.43, 0.43, 0.38, 0.35, 0.34].map(fix);
    expect(agentLine(fixes, page)).toBe(
      'Start here. The first five fixes return 2.4 of the 3.1 points this page is missing.'
    );
  });

  it('claims "more than the next four" only when it is true', () => {
    expect(agentLine([5, 1, 1, 1, 1, 0.5].map(fix), page)).toMatch(/more than the next four together/);
    expect(agentLine([2, 1, 1, 1, 1, 0.5].map(fix), page)).not.toMatch(/next four/);
  });

  it('speaks to the whole site on a crawl', () => {
    expect(agentLine([0.5, 0.2].map(fix), { ...page, crawledPages: 40 })).toBe(
      'Start here. These 2 fixes return all 0.7 points this site is missing.'
    );
  });

  it('leads with the cap while one holds, and has nothing to say when nothing failed', () => {
    const capped = { ...page, scoreCap: { uncappedScore: 88, caps: [{ id: 'noindex', ceiling: 20, reason: '' }] } };
    expect(agentLine([fix(1)], capped)).toBe('Start here. Nothing else moves the score until this is fixed.');
    expect(agentLine([], page)).toBe('Nothing to fix in what we measured.');
  });
});

describe('nextGrade', () => {
  it('measures to half a point under the threshold, because the grade reads the rounded score', () => {
    // 89.4 rounds to 89 (Good); 89.5 already rounds to 90 (Excellent)
    expect(nextGrade(89.4, [fix(0.3)])).toEqual({ label: 'Excellent', gap: expect.closeTo(0.1, 9), fixes: 1 });
    expect(nextGrade(89.5, [fix(0.3)]).label).toBeNull();
  });

  it('counts the shortest run from the top of the queue that covers the gap', () => {
    // 76.0 -> Good needs 3.5: 2 + 1 is 3.0, the third fix covers it
    expect(nextGrade(76, [2, 1, 1, 1].map(fix))).toEqual({ label: 'Good', gap: 3.5, fixes: 3 });
  });

  it('says so at the top grade', () => {
    expect(nextGradeLine(91.24, [fix(8.76)])).toBe('Top grade. 8.8 points left to 100.');
    expect(nextGradeLine(100, [])).toBe('Top grade, nothing left to fix.');
    expect(nextGradeLine(76, [2, 1, 1, 1].map(fix))).toBe('3.5 points to Good: the first 3 fixes get you there.');
  });
});
