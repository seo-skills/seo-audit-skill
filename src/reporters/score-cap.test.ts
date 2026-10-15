/**
 * A capped score is explained wherever it is shown.
 *
 * A page that averages 94 across its categories and reports 20 overall looks
 * like an arithmetic bug unless the report says which condition held it down.
 * Every surface that prints the overall score must print the cap beside it.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import '../rules/loader.js';
import { renderTerminalReport } from './terminal.js';
import { renderMarkdownReport } from './markdown-reporter.js';
import { renderLlmReport } from './llm-reporter.js';
import { renderHtmlReport } from './html-reporter.js';
import type { AuditResult } from '../types.js';

const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g');

const REASON = 'A robots directive tells Google not to index this page & keeps it out of search';

const capped: AuditResult = {
  url: 'https://example.com/',
  overallScore: 20,
  scoreCap: {
    uncappedScore: 94,
    caps: [{ id: 'noindex', ceiling: 20, reason: REASON }],
  },
  categoryResults: [
    {
      categoryId: 'core',
      score: 94,
      passCount: 1,
      warnCount: 1,
      failCount: 0,
      notMeasuredCount: 0,
      results: [
        { ruleId: 'core-title-present', status: 'pass', score: 100, weight: 25, message: 'Title tag is present' },
        { ruleId: 'core-robots-meta', status: 'warn', score: 50, weight: 5, message: 'Restrictive indexing directives found: robots: "noindex"' },
      ],
    },
  ],
  timestamp: '2026-10-15T00:00:00.000Z',
  crawledPages: 1,
};

const uncapped: AuditResult = { ...capped, overallScore: 94, scoreCap: undefined };

function terminal(result: AuditResult): string {
  const lines: string[] = [];
  vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
    lines.push(args.join(' '));
  });
  renderTerminalReport(result);
  return lines.join('\n').replace(ANSI, '');
}

afterEach(() => vi.restoreAllMocks());

describe('a capped score', () => {
  it('is explained in the terminal, under the score', () => {
    const out = terminal(capped);
    expect(out).toContain('Health Score: 20/100');
    expect(out).toContain('Capped from 94');
    expect(out.indexOf(REASON)).toBeGreaterThan(out.indexOf('Health Score'));
  });

  it('is explained in Markdown', () => {
    const out = renderMarkdownReport(capped);
    expect(out).toContain('Capped from **94**');
    expect(out).toContain(`- ${REASON}`);
  });

  it('is explained to a model, escaped', () => {
    const out = renderLlmReport(capped);
    expect(out).toContain('<score-cap uncapped="94">');
    expect(out).toContain('<cap id="noindex" ceiling="20">');
    expect(out).toContain('keeps it out of search');
    expect(out).not.toContain('page & keeps');
  });

  it('is explained in HTML, escaped', () => {
    const out = renderHtmlReport(capped);
    expect(out).toContain('Capped from 94');
    expect(out).toContain('page &amp; keeps');
  });
});

describe('an uncapped score', () => {
  it('says nothing about caps on any surface', () => {
    expect(terminal(uncapped)).not.toContain('Capped from');
    expect(renderMarkdownReport(uncapped)).not.toContain('Capped from');
    expect(renderLlmReport(uncapped)).not.toContain('score-cap');
    expect(renderHtmlReport(uncapped)).not.toContain('Capped from');
  });
});
