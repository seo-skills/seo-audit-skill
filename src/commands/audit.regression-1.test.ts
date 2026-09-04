// Regression: ISSUE-002 — html and markdown wrote a stray file instead of streaming
// Found by /qa on 2026-09-04
// Report: .gstack/qa-reports/qa-report-127-0-0-1-2026-09-04.md
//
// Four document formats, two behaviours. json and llm streamed to stdout and
// wrote a file only with `-o`; html and markdown always wrote
// `seo-report-<id>.<ext>` into the working directory and printed the terminal
// progress summary to stdout instead, so `--format markdown > report.md`
// captured coloured category lines and left the real report behind under a
// name the caller never chose.
//
// This asserts the routing decision rather than driving the whole CLI: which
// formats must keep stdout clean, and which write a file only on `-o`.
import { describe, it, expect } from 'vitest';
import { isDocumentFormat } from './audit.js';

/**
 * A format whose job is to put a document on stdout must suppress progress and
 * write a file only when the caller names one.
 */
const DOCUMENT_FORMATS = ['json', 'llm', 'html', 'markdown'] as const;

describe('every document format keeps stdout for the document', () => {
  it.each(DOCUMENT_FORMATS)('%s suppresses progress output', (format) => {
    expect(isDocumentFormat(format)).toBe(true);
  });

  it('console is the only format that may print progress to stdout', () => {
    expect(isDocumentFormat('console')).toBe(false);
  });

  it('covers all four, so adding a fifth cannot silently skip the rule', () => {
    // The original bug was a list naming two of the four.
    expect(DOCUMENT_FORMATS.filter(isDocumentFormat)).toEqual([...DOCUMENT_FORMATS]);
  });
});

describe('the audit command routes output the same way for every format', () => {
  const source = new URL('./audit.ts', import.meta.url).pathname;

  it('writes a file only when an output path is given', async () => {
    const { readFileSync } = await import('node:fs');
    const text = readFileSync(source, 'utf8');

    // The invented filename is what made a stray report appear on every run.
    expect(text).not.toMatch(/seo-report-\$\{generateId\(\)\}/);
    expect(text).not.toMatch(/outputPath \?\? `seo-report-/);
  });

  it('sends save confirmations to stderr, so a redirect captures only the document', async () => {
    const { readFileSync } = await import('node:fs');
    const text = readFileSync(source, 'utf8');

    for (const label of ['HTML report saved to', 'Markdown report saved to', 'Report saved to']) {
      const line = text.split('\n').find((l) => l.includes(label));
      expect(line, `"${label}" should be logged`).toBeDefined();
      expect(line, `"${label}" must go to stderr`).toContain('console.error');
    }
  });
});
