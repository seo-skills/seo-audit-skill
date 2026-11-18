/**
 * The terminal groups by category, which is right for a terminal. Inside a
 * category, issues were left in the order their rules happened to register, so
 * a weight-1 warning could print above a weight-25 one — the same defect the
 * HTML report had, on the surface most people actually read.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import '../rules/loader.js';
import { renderTerminalReport } from './terminal.js';
import type { AuditResult, RuleResult, CategoryResult } from '../types.js';

/** Strip SGR sequences, so an assertion does not depend on TTY detection. */
const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g');

function capture(result: AuditResult): string {
  const lines: string[] = [];
  const spy = vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
    lines.push(args.join(' '));
  });
  try {
    renderTerminalReport(result);
  } finally {
    spy.mockRestore();
  }
  return lines.join('\n').replace(ANSI, '');
}

afterEach(() => vi.restoreAllMocks());

function rule(ruleId: string, status: RuleResult['status'], weight = 1): RuleResult {
  return {
    ruleId,
    status,
    score: status === 'fail' ? 0 : status === 'warn' ? 50 : 100,
    weight,
    message: `${ruleId} reported something`,
    details: { pageUrl: 'https://example.com/' },
  };
}

function notMeasured(ruleId: string): RuleResult {
  return {
    ruleId,
    status: 'not-measured',
    score: 50,
    weight: 0,
    message: `${ruleId} took no reading`,
    details: { pageUrl: 'https://example.com/' },
  };
}

function report(categoryId: string, results: RuleResult[]): AuditResult {
  const categoryResults: CategoryResult[] = [
    {
      categoryId,
      score: 50,
      passCount: 0,
      warnCount: results.filter((r) => r.status === 'warn').length,
      failCount: results.filter((r) => r.status === 'fail').length,
      notMeasuredCount: results.filter((r) => r.status === 'not-measured').length,
      results,
    },
  ];
  return {
    url: 'https://example.com',
    overallScore: 50,
    categoryResults,
    timestamp: new Date().toISOString(),
    crawledPages: 1,
  };
}

describe('terminal issue ordering', () => {
  it('puts a heavier warning above a lighter one in the same category', () => {
    // perf-render-blocking carries far more weight than perf-font-display.
    const out = capture(
      report('perf', [rule('perf-font-display', 'warn'), rule('perf-render-blocking', 'warn')])
    );
    expect(out.indexOf('perf-render-blocking')).toBeLessThan(out.indexOf('perf-font-display'));
  });

  it('keeps failures above warnings whatever their weight', () => {
    const out = capture(
      report('perf', [
        rule('perf-render-blocking', 'warn', 20),
        rule('perf-font-display', 'fail', 3),
      ])
    );
    expect(out.indexOf('perf-font-display')).toBeLessThan(out.indexOf('perf-render-blocking'));
  });

  it('sinks unmeasured checks below real findings', () => {
    // "we did not check this" is not a finding and must not head the list.
    const out = capture(
      report('mobile', [
        notMeasured('mobile-parity-title'),
        rule('mobile-horizontal-scroll', 'warn'),
      ])
    );
    expect(out.indexOf('mobile-horizontal-scroll')).toBeLessThan(out.indexOf('mobile-parity-title'));
  });

  it('does not draw an unmeasured check with the warning icon', () => {
    // It was a yellow warning triangle, one line under the label "(not measured)".
    const out = capture(report('mobile', [notMeasured('mobile-parity-title')]));
    const line = out.split('\n').find((l) => l.includes('took no reading')) ?? '';
    expect(line).toContain('–');
    expect(line).not.toContain('⚠');
  });
});

describe('site text in the terminal', () => {
  it('cannot send a terminal escape sequence through a rule message', async () => {
    const { twitterAttributeRule } = await import('../rules/social/twitter-attribute.js');
    const { createTestContext } = await import('../rules/test-context.js');
    // A page writes ESC, BEL and CR as character references; the parser decodes them
    const page = '<html><head><meta property="twitter:card&#x1b;]0;retitled&#x07;&#x0d;" content="summary"></head><body></body></html>';
    const finding = await twitterAttributeRule.run(createTestContext(page));
    expect(finding.message).toContain(String.fromCharCode(27));

    const out = capture(report('social', [{ ...finding, weight: 1, details: { pageUrl: 'https://example.com/' } }]));
    expect(out).toContain('retitled');
    expect(out).not.toMatch(/[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/);
  });
});

describe('a deeply nested result', () => {
  it('renders: a page cannot crash the console report with nesting', () => {
    let deep: Record<string, unknown> = { value: 'bottom' };
    for (let i = 0; i < 5000; i++) deep = { next: deep };
    const finding: RuleResult = { ...rule('schema-type', 'warn'), details: { pageUrl: 'https://example.com/', types: deep } };
    expect(() => capture(report('schema', [finding]))).not.toThrow();
  });
});
