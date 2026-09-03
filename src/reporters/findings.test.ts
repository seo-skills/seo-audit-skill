/**
 * One finding per problem.
 *
 * A live crawl emits one rule result per rule per page. The markdown report
 * turned that into one `### rule-id` section per page — forty identical
 * sections on a forty-page site — and the LLM report into forty `<issue>`
 * elements, which is forty times the tokens for one problem and reads to a
 * model as forty separate problems.
 */
import { describe, it, expect } from 'vitest';
import '../rules/loader.js';
import { collectFindings } from './findings.js';
import { renderMarkdownReport } from './markdown-reporter.js';
import { renderLlmReport } from './llm-reporter.js';
import type { AuditResult, RuleResult, CategoryResult } from '../types.js';

const PAGES = ['https://e.com/', 'https://e.com/a', 'https://e.com/b'];

function res(ruleId: string, pageUrl: string, status: RuleResult['status'] = 'fail'): RuleResult {
  return {
    ruleId,
    status,
    score: status === 'fail' ? 0 : 50,
    weight: 5,
    message: 'Something is wrong',
    details: { pageUrl },
  };
}

function crawl(results: RuleResult[]): AuditResult {
  const categoryResults: CategoryResult[] = [
    {
      categoryId: 'perf',
      score: 40,
      passCount: 0,
      warnCount: results.filter((r) => r.status === 'warn').length,
      failCount: results.filter((r) => r.status === 'fail').length,
      notMeasuredCount: 0,
      results,
    },
  ];
  return {
    url: 'https://e.com',
    overallScore: 40,
    categoryResults,
    timestamp: new Date().toISOString(),
    crawledPages: PAGES.length,
    coverage: { pages: PAGES, detail: 'per-page' },
  };
}

describe('collectFindings', () => {
  it('collapses one rule seen on three pages into one finding', () => {
    const findings = collectFindings(crawl(PAGES.map((p) => res('perf-render-blocking', p))));
    expect(findings).toHaveLength(1);
    expect(findings[0].pageCount).toBe(3);
    expect(findings[0].pages).toEqual(PAGES);
  });

  it('groups messages that differ only in a varying number', () => {
    const results = PAGES.map((p, i) => ({
      ...res('perf-render-blocking', p),
      message: `Blocking for ${(i + 1) * 120}ms`,
    }));
    expect(collectFindings(crawl(results))).toHaveLength(1);
  });

  it('keeps genuinely different messages apart', () => {
    const results = [
      { ...res('perf-render-blocking', PAGES[0]), message: 'A script blocks' },
      { ...res('perf-render-blocking', PAGES[1]), message: 'A stylesheet blocks' },
    ];
    expect(collectFindings(crawl(results))).toHaveLength(2);
  });

  it('puts failures above warnings', () => {
    const findings = collectFindings(
      crawl([res('perf-render-blocking', PAGES[0], 'warn'), res('perf-asset-size', PAGES[0], 'fail')])
    );
    expect(findings[0].status).toBe('fail');
  });

  it('actually ranks by impact, not just by page count', () => {
    // The first cut read the priority back off the finding it had just
    // initialised to 0, and `0 ?? compute` is 0 — so every finding ranked zero
    // and the order silently fell through to page count. Every test still
    // passed, because grouping was correct and only the order was wrong.
    const findings = collectFindings(
      crawl([
        // Weight 1 in a 1% category, seen on all three pages.
        ...PAGES.map((p) => ({ ...res('legal-cookie-consent', p), message: 'Low impact' })),
        // Weight 20 in a 10% category, seen on one.
        { ...res('perf-render-blocking', PAGES[0]), message: 'High impact' },
      ])
    );
    expect(findings.map((f) => f.ruleId)).toEqual(['perf-render-blocking', 'legal-cookie-consent']);
    expect(findings[0].priority).toBeGreaterThan(findings[1].priority);
    expect(findings[0].priority).toBeGreaterThan(0);
  });

  it('excludes passes', () => {
    expect(collectFindings(crawl([res('perf-render-blocking', PAGES[0], 'pass')]))).toHaveLength(0);
  });
});

describe('markdown report', () => {
  const md = renderMarkdownReport(crawl(PAGES.map((p) => res('perf-render-blocking', p))));

  it('writes one section, not one per page', () => {
    expect(md.split('\n').filter((l) => l.startsWith('### '))).toHaveLength(1);
  });

  it('says which pages the finding covers', () => {
    expect(md).toMatch(/\*\*Affects:\*\* 3 of 3 pages/);
  });
});

describe('llm report', () => {
  it('emits one issue, not one per page', () => {
    const xml = renderLlmReport(crawl(PAGES.map((p) => res('perf-render-blocking', p))));
    expect((xml.match(/<issue /g) ?? []).length).toBe(1);
    expect(xml).toContain('pages="3"');
  });

  it('caps a long list and says how much it left out', () => {
    // 60 distinct rules, one page each.
    const many = Array.from({ length: 60 }, (_, i) => ({
      ...res(`perf-rule-${i}`, PAGES[0]),
      message: `Problem number ${i} of kind alpha`,
    }));
    const xml = renderLlmReport(crawl(many));
    expect((xml.match(/<issue /g) ?? []).length).toBe(50);
    expect(xml).toContain('total="60"');
    expect(xml).toContain('omitted="10"');
  });

  it('does not claim omission when nothing is omitted', () => {
    const xml = renderLlmReport(crawl([res('perf-render-blocking', PAGES[0])]));
    expect(xml).not.toContain('omitted=');
  });
});
