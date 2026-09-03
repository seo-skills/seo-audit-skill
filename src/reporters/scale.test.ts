/**
 * A 1,000-page audit is a budget, not a hope.
 *
 * Everything the reporters do is per-rule-per-page on a live crawl, and the
 * 8-page fixture hides that completely. Measured before this test existed, a
 * 1,000-page render produced:
 *
 *   html      69.28 MB   — 48.11 MB of it 340,004 page anchors, and
 *                          20.59 MB of it full URL lists repeated in
 *                          `data-urls` on both the row and the card
 *   llm        1.44 MB   — 113,000 entries in <passed>, one per rule per page
 *
 * Nothing asserted any of it, so nothing noticed. These budgets are set well
 * above where the reporters now land, so they catch a regression in kind
 * (per-page growth reappearing) rather than bickering over kilobytes.
 */
import { describe, it, expect } from 'vitest';
import '../rules/loader.js';
import { renderHtmlReport } from './html-reporter.js';
import { renderLlmReport } from './llm-reporter.js';
import { renderMarkdownReport } from './markdown-reporter.js';
import type { AuditResult, CategoryResult, RuleResult } from '../types.js';

const CATS = [
  'core', 'perf', 'links', 'images', 'security', 'a11y', 'technical', 'crawl', 'schema', 'content',
  'js', 'social', 'eeat', 'url', 'redirect', 'mobile', 'i18n', 'htmlval', 'geo', 'legal',
];

const MB = 1024 * 1024;

/** A live crawl's shape: one result per rule per page. */
function buildCrawl(pageCount: number, rulesPerCat = 17): AuditResult {
  const pages = Array.from(
    { length: pageCount },
    (_, i) => `https://example.com/section-${Math.floor(i / 20)}/page-${i}-with-a-realistic-slug`
  );

  const categoryResults: CategoryResult[] = CATS.map((categoryId) => {
    const results: RuleResult[] = [];
    for (let r = 0; r < rulesPerCat; r++) {
      // A third fail on every page — the worst realistic case, because every
      // page URL then lands in a single group.
      const status = (r % 3 === 0 ? 'fail' : r % 3 === 1 ? 'warn' : 'pass') as RuleResult['status'];
      for (const pageUrl of pages) {
        results.push({
          ruleId: `${categoryId}-rule-${r}`,
          status,
          score: status === 'pass' ? 100 : status === 'warn' ? 50 : 0,
          weight: 5,
          message: `${categoryId}-rule-${r} reported a consistent finding`,
          details: { pageUrl },
        });
      }
    }
    return {
      categoryId,
      score: 55,
      passCount: results.filter((r) => r.status === 'pass').length,
      warnCount: results.filter((r) => r.status === 'warn').length,
      failCount: results.filter((r) => r.status === 'fail').length,
      notMeasuredCount: 0,
      results,
    };
  });

  return {
    url: 'https://example.com',
    overallScore: 55,
    categoryResults,
    timestamp: new Date().toISOString(),
    crawledPages: pageCount,
    coverage: { pages, detail: 'per-page' },
  };
}

describe('a 1,000-page crawl stays within budget', () => {
  const result = buildCrawl(1000);

  it('renders HTML under 5 MB', () => {
    // Was 69.28 MB.
    expect(renderHtmlReport(result).length).toBeLessThan(5 * MB);
  }, 120_000);

  it('renders the agent report under 250 KB', () => {
    // Was 1.44 MB — a report meant to fit in a model's context. The size came
    // from listing each finding once per page, not from the finding count, so
    // the fix is dedupe; the cap only bounds the pathological case.
    expect(renderLlmReport(result).length).toBeLessThan(250 * 1024);
  }, 120_000);

  it('renders markdown under 1 MB', () => {
    expect(renderMarkdownReport(result).length).toBeLessThan(MB);
  }, 120_000);

  it('never repeats a full URL list in an attribute', () => {
    // The `data-urls` attribute carried every affected URL, twice per rule.
    const html = renderHtmlReport(result);
    expect(html).not.toContain('data-urls=');
    for (const attr of html.match(/data-pages="[^"]*"/g) ?? []) {
      // Indices, or `*` for every page. Never a URL.
      expect(attr).not.toContain('http');
    }
  }, 120_000);

  it('emits the page list exactly once', () => {
    const html = renderHtmlReport(result);
    expect((html.match(/REPORT_PAGES = /g) ?? []).length).toBe(1);
    // 1,000 pages, each named once in that list and a handful of times in the
    // capped per-rule samples and the filter dropdown — not once per finding.
    const occurrences = (html.match(/section-\d+\/page-\d+/g) ?? []).length;
    expect(occurrences).toBeLessThan(1000 * 10);
  }, 120_000);

  it('caps the per-rule page list rather than listing every page', () => {
    const html = renderHtmlReport(result);
    expect(html).toContain('more');
    // 340 rules x 1,000 pages would be 340,000 anchors.
    expect((html.match(/<a [^>]*href="https:\/\/example\.com\/section-/g) ?? []).length).toBeLessThan(
      10_000
    );
  }, 120_000);

  it('lists a passed rule once, not once per page', () => {
    const xml = renderLlmReport(result);
    const passed = xml.match(/<passed>([^<]*)<\/passed>/);
    expect(passed).not.toBeNull();
    const ids = passed![1].split(', ').filter(Boolean);
    expect(ids.length).toBe(new Set(ids).size);
    // 113 passing rules across 1,000 pages was 113,000 entries.
    expect(ids.length).toBeLessThan(400);
  }, 120_000);

  it('scales sub-linearly: ten times the pages is not ten times the report', () => {
    const small = renderHtmlReport(buildCrawl(100)).length;
    const large = renderHtmlReport(buildCrawl(1000)).length;
    // Page count x10. The report may grow, but the per-page cost has to fall
    // away — that is the whole difference between a budget and a blowup.
    expect(large).toBeLessThan(small * 3);
  }, 240_000);
});
