/**
 * A report must not offer a filter it cannot honour.
 *
 * The HTML reporter reconstructed its page list by scraping `pageUrl` out of
 * rule details. That works while every rule result carries its own page — a
 * live crawl — and quietly breaks once results are aggregated to one row per
 * rule with a capped sample of pages. An eight-page crawl then advertised
 * "8 pages" in its header, offered seven in its "Filter by Page" dropdown, and
 * returned one or two rules for whichever page you picked. The page that never
 * made it into any sample could not be reached at all.
 */
import { describe, it, expect } from 'vitest';
import { renderHtmlReport } from './html-reporter.js';
import type { AuditResult, CategoryResult } from '../types.js';

const PAGES = [
  'https://example.com/',
  'https://example.com/blog',
  'https://example.com/pricing',
];

function categoryResults(withPageUrls: string[]): CategoryResult[] {
  return [
    {
      categoryId: 'core',
      score: 100,
      passCount: withPageUrls.length,
      warnCount: 0,
      failCount: 0,
      notMeasuredCount: 0,
      results: withPageUrls.map((url) => ({
        ruleId: 'core-title',
        status: 'pass' as const,
        score: 100,
        weight: 1,
        message: 'Title is present',
        details: { pageUrl: url },
      })),
    },
  ];
}

function result(over: Partial<AuditResult>): AuditResult {
  return {
    url: 'https://example.com',
    overallScore: 100,
    categoryResults: categoryResults(PAGES),
    timestamp: new Date().toISOString(),
    crawledPages: PAGES.length,
    ...over,
  };
}

describe('html report page coverage', () => {
  it('offers a page filter when every result carries its own page', () => {
    const html = renderHtmlReport(result({ coverage: { pages: PAGES, detail: 'per-page' } }));
    expect(html).toContain('id="url-filter"');
    expect(html).toContain(`All pages (${PAGES.length})`);
    expect(html).not.toContain('<details class="pages-covered">');
  });

  it('lists the pages instead of filtering when results are aggregated', () => {
    // One row per rule, as a stored audit reconstructs it.
    const html = renderHtmlReport(
      result({
        categoryResults: categoryResults([PAGES[0]]),
        coverage: { pages: PAGES, detail: 'aggregated' },
      })
    );
    expect(html).not.toContain('id="url-filter"');
    expect(html).toContain('<details class="pages-covered">');
    expect(html).toContain(`${PAGES.length} pages audited`);
  });

  it('lists a page that no rule result names', () => {
    // The regression: `/pricing` is covered by the audit but appears in no
    // rule's details, so scraping could never recover it.
    const html = renderHtmlReport(
      result({
        categoryResults: categoryResults([PAGES[0], PAGES[1]]),
        coverage: { pages: PAGES, detail: 'aggregated' },
      })
    );
    expect(html).toContain('/pricing');
    expect(html).toContain('3 pages audited');
  });

  it('agrees with itself: the header count is the number of pages listed', () => {
    const html = renderHtmlReport(
      result({
        categoryResults: categoryResults([PAGES[0]]),
        crawledPages: 3,
        coverage: { pages: PAGES, detail: 'aggregated' },
      })
    );
    const header = html.match(/<span>(\d+) pages<\/span>/);
    const listed = html.match(/<summary>(\d+) pages audited<\/summary>/);
    expect(header?.[1]).toBe(listed?.[1]);
  });

  it('still renders for an audit stored before coverage existed', () => {
    const html = renderHtmlReport(result({}));
    expect(html).toContain('id="url-filter"'); // falls back to scraped URLs
    expect(html).toContain('SEO Audit');
  });
});
