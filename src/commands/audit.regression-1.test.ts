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
import { describe, it, expect, vi } from 'vitest';
import { isDocumentFormat, writeReport } from './audit.js';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

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
  it('never invents an output filename the caller did not ask for', async () => {
    const { readFileSync } = await import('node:fs');
    const text = readFileSync(new URL('./audit.ts', import.meta.url).pathname, 'utf8');

    // The invented filename is what made a stray report appear on every run.
    expect(text).not.toMatch(/seo-report-\$\{generateId\(\)\}/);
    expect(text).not.toMatch(/outputPath \?\? `seo-report-/);
  });

  it('sends the save confirmation to stderr, so a redirect captures only the document', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'seomator-stderr-'));
    const out = join(dir, 'report.json');
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});

    try {
      writeReport(out, '{}', 'Report');
      expect(err).toHaveBeenCalledWith(expect.stringContaining('Report saved to'));
      // stdout belongs to the document, not to status lines.
      expect(log).not.toHaveBeenCalled();
    } finally {
      err.mockRestore();
      log.mockRestore();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
