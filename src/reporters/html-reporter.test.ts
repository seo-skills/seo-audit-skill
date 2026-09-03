import { describe, it, expect } from 'vitest';
// Side-effect import: registers every rule, so the reporter resolves real rule
// names and descriptions rather than falling back to the formatted rule id.
import '../rules/loader.js';
import { renderHtmlReport } from './html-reporter.js';
import type { AuditResult, RuleResult } from '../types.js';

/**
 * Slice out one rule card by id.
 *
 * Matching on the id alone finds the issues-summary table row first, since that
 * table renders above the category sections. The status attribute precedes the
 * id on the card itself, which is what makes the match unambiguous.
 */
function cardFor(html: string, status: string, ruleId: string): string {
  const start = html.indexOf(`data-status="${status}" data-rule-id="${ruleId}"`);
  expect(start).toBeGreaterThan(-1);
  const end = html.indexOf('<div class="rule-card"', start + 1);
  return html.slice(start, end === -1 ? undefined : end);
}

/**
 * A result that took no reading. `notMeasured()` encodes this as status 'warn'
 * with weight 0, because RuleResult has no fourth status — weight 0 is the only
 * marker distinguishing it from a real warning.
 */
function unmeasured(ruleId: string, message: string, url: string): RuleResult {
  return { ruleId, status: 'warn', message, score: 50, weight: 0, details: { url } };
}

function weighted(
  ruleId: string,
  status: 'pass' | 'warn' | 'fail',
  message: string,
  url: string
): RuleResult {
  return {
    ruleId,
    status,
    message,
    score: status === 'pass' ? 100 : status === 'warn' ? 50 : 0,
    weight: 1,
    details: { url },
  };
}

function buildResult(overrides: Partial<AuditResult> = {}): AuditResult {
  const url = 'https://example.com';
  return {
    url,
    overallScore: 85,
    timestamp: '2026-05-08T00:00:00.000Z',
    crawledPages: 1,
    categoryResults: [
      {
        categoryId: 'perf',
        score: 90,
        passCount: 1,
        warnCount: 1,
        failCount: 1,
        notMeasuredCount: 1,
        results: [
          weighted('cwv-lcp', 'pass', 'LCP is 0.44s (good, under 2.5s)', url),
          weighted('perf-page-weight', 'warn', 'HTML document is 200KB', url),
          weighted('perf-render-blocking', 'fail', 'Render-blocking resources found', url),
          unmeasured('cwv-inp', 'INP not measured - it requires real user interaction', url),
        ],
      },
    ],
    ...overrides,
  };
}

describe('renderHtmlReport — unmeasured checks are not warnings', () => {
  it('gives a weight-0 result its own display status rather than amber', () => {
    const out = renderHtmlReport(buildResult());
    expect(out).toContain('data-rule-id="cwv-inp"');
    expect(out).toMatch(/data-status="notmeasured" data-rule-id="cwv-inp"/);
    // The real warning keeps its amber status.
    expect(out).toMatch(/data-status="warn" data-rule-id="perf-page-weight"/);
  });

  it('counts it separately from warnings in the filter tabs', () => {
    const out = renderHtmlReport(buildResult());
    expect(out).toMatch(/Warnings <span class="filter-tab-count">1<\/span>/);
    expect(out).toMatch(/Not measured <span class="filter-tab-count">1<\/span>/);
  });

  it('offers no fix advice for a check that took no reading', () => {
    const inpCard = cardFor(renderHtmlReport(buildResult()), 'notmeasured', 'cwv-inp');
    expect(inpCard).not.toContain('How to fix');
    expect(inpCard).toContain('Not measured');
  });

  it('still offers fix advice for a real warning', () => {
    const warnCard = cardFor(renderHtmlReport(buildResult()), 'warn', 'perf-page-weight');
    expect(warnCard).toContain('How to fix');
  });

  it('keeps unmeasured checks out of the issues-to-fix table', () => {
    const out = renderHtmlReport(buildResult());
    const table = out.slice(out.indexOf('issues-summary'), out.indexOf('</table>'));
    expect(table).toContain('perf-page-weight');
    expect(table).not.toContain('cwv-inp');
  });

  it('omits the Not measured tab entirely when every check took a reading', () => {
    const result = buildResult();
    result.categoryResults[0].results = result.categoryResults[0].results.filter(
      (r) => r.weight !== 0
    );
    const out = renderHtmlReport(result);
    expect(out).not.toContain('data-filter="notmeasured"');
  });
});

describe('renderHtmlReport — single-page reports', () => {
  it('drops the per-rule page link when the report covers one URL', () => {
    const out = renderHtmlReport(buildResult());
    expect(out).not.toContain('class="pages-inline"');
    expect(out).not.toContain('<th>Page</th>');
  });

  it('keeps the per-rule page link once a second URL appears', () => {
    const result = buildResult();
    result.crawledPages = 2;
    result.categoryResults[0].results.push(
      weighted('cwv-lcp', 'fail', 'LCP is 5.1s', 'https://example.com/pricing')
    );
    const out = renderHtmlReport(result);
    expect(out).toContain('class="pages-inline"');
    expect(out).toContain('<th>Page</th>');
  });

  it('names the site root "Homepage" rather than a bare slash', () => {
    const out = renderHtmlReport(buildResult());
    expect(out).toContain('<span>Homepage</span>');
  });
});

describe('renderHtmlReport — branding', () => {
  it('inlines the wordmark so the report needs no network fetch', () => {
    const out = renderHtmlReport(buildResult());
    expect(out).toContain('aria-label="SEOmator"');
    expect(out).not.toContain('logo.svg');
    expect(out).not.toMatch(/<img[^>]+src="https?:/);
  });

  it('lets the wordmark lettering follow the theme', () => {
    const out = renderHtmlReport(buildResult());
    // Unfilled paths default to black, which disappears against the dark theme.
    expect(out).toContain('<g transform="translate(0 -2)" fill="currentColor">');
  });

  it('names the product and points at the hosted tool', () => {
    const out = renderHtmlReport(buildResult());
    expect(out).toContain('SEO Audit');
    expect(out).toContain('Open Source');
    expect(out).toContain('SEO Audit Open Source');
    expect(out).toContain('https://seomator.com/free-seo-audit-tool');
    expect(out).toContain('seomator.com/free-seo-audit-tool</a>');
  });

  it('opens outbound brand links safely in a new tab', () => {
    const out = renderHtmlReport(buildResult());
    const brand = out.slice(out.indexOf('class="header-brand"'), out.indexOf('</a>', out.indexOf('class="header-brand"')));
    expect(brand).toContain('target="_blank"');
    expect(brand).toContain('rel="noopener"');
  });
});

describe('renderHtmlReport — the finding leads the card', () => {
  it('renders the measured result above the rule definition', () => {
    const card = cardFor(renderHtmlReport(buildResult()), 'pass', 'cwv-lcp');
    const message = card.indexOf('LCP is 0.44s (good, under 2.5s)');
    const description = card.indexOf('class="rule-description"');
    expect(message).toBeGreaterThan(-1);
    // The definition is present for reference, but the finding reads first.
    expect(description).toBeGreaterThan(message);
  });
});
