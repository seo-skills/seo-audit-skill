// Regression: ISSUE-013 — `analyze --json` printed status in front of the JSON
//             ISSUE-014 — an analysed audit did not record its rule filter
// Found by /qa on 2026-09-04
// Report: .gstack/qa-reports/qa-report-cli-agent-2026-09-04.md
//
// `seomator analyze <id> --json` emitted four human-readable lines on stdout
// before the payload:
//
//   Analyzing crawl...
//     Crawl ID: 2026-09-04-5b4876
//     URL: https://example.com
//     Pages: 1
//
//   { "schemaVersion": 2, ...
//
// so an agent's `JSON.parse` failed on the first character. The command already
// guarded `options.json` in three other places and missed these five lines,
// which is the same shape as ISSUE-002 in `audit.ts` a day earlier: a
// per-format guard repeated inline gets extended in some places and not others.
//
// The fix is the split `audit` already uses — stdout carries the document,
// stderr carries status — so there is no guard left to forget.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { announceAnalysis } from './analyze.js';

const crawl = {
  id: '2026-09-04-5b4876',
  url: 'https://example.com',
  pages: [{ url: 'https://example.com' }],
} as never;

afterEach(() => vi.restoreAllMocks());

describe('analyze keeps stdout for the document', () => {
  it('writes nothing at all to stdout', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    announceAnalysis(crawl);

    // A single stdout write here is what made the payload unparseable.
    expect(log).not.toHaveBeenCalled();
  });

  it('still tells the user which crawl is running, on stderr', () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});

    announceAnalysis(crawl);

    const said = err.mock.calls.flat().join(' ');
    expect(said).toContain('Analyzing crawl');
    expect(said).toContain('2026-09-04-5b4876');
    expect(said).toContain('https://example.com');
  });

  it('reports the page count, so a truncated crawl is visible', () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});

    announceAnalysis({ ...crawl, pages: [{}, {}, {}] } as never);

    expect(err.mock.calls.flat().join(' ')).toContain('3');
  });
});

describe('the analyze command routes output like the audit command', () => {
  const source = new URL('./analyze.ts', import.meta.url).pathname;

  it('leaves the document renderers as the only stdout writers', async () => {
    const { readFileSync } = await import('node:fs');
    const text = readFileSync(source, 'utf8');

    // Every remaining console.log must be a report render, not a status line.
    // The three `if (!options.json) console.log(...)` guards this replaced were
    // each correct on their own and still let five lines through.
    const stdoutWrites = text
      .split('\n')
      .filter((l) => {
        const t = l.trim();
        // Skip comments, including the JSDoc that explains this very rule.
        return l.includes('console.log') && !t.startsWith('//') && !t.startsWith('*');
      });
    expect(stdoutWrites, `unexpected stdout writes:\n${stdoutWrites.join('\n')}`).toEqual([]);
  });

  it('records the rule filter on the stored run', async () => {
    const { readFileSync } = await import('node:fs');
    const text = readFileSync(source, 'utf8');

    // analyze applies rules.enable/disable, so the run it saves has to carry
    // them. Without this, `compare` reads a filtered analysis as like-for-like
    // against a full audit and calls the score drop a regression.
    expect(text).toMatch(/enableRules:\s*config\.rules\.enable/);
    expect(text).toMatch(/disableRules:\s*config\.rules\.disable/);
  });
});
