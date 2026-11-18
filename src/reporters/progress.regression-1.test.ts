// Regression: ISSUE-005 — the CLI hung and flooded a terminal that reports 0 columns
// Found by /qa on 2026-11-18
// Report: .gstack/qa-reports/run-20261118T115906Z/qa-report-seomator-cli-2026-11-18.md
//
// The category spinner counts the lines it must erase as the text width divided
// by the terminal width. Some embedded and IDE terminals report a width of 0, so
// the count became Infinity and every frame erased lines forever: the audit never
// finished. A terminal with no width gets plain status lines instead.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { ProgressReporter } from './progress.js';

type Spinner = { isEnabled: boolean } | null;
const spinnerOf = (progress: ProgressReporter) => (progress as unknown as { spinner: Spinner }).spinner;

/** Make stderr look like a terminal of the given width, for one test */
function terminal(columns: number): () => void {
  const saved = ['isTTY', 'columns', 'moveCursor', 'clearLine', 'cursorTo'].map(
    (key) => [key, Object.getOwnPropertyDescriptor(process.stderr, key)] as const
  );
  Object.defineProperty(process.stderr, 'isTTY', { value: true, configurable: true });
  Object.defineProperty(process.stderr, 'columns', { value: columns, configurable: true });
  for (const key of ['moveCursor', 'clearLine', 'cursorTo']) {
    Object.defineProperty(process.stderr, key, { value: () => true, configurable: true, writable: true });
  }
  vi.spyOn(process.stderr, 'write').mockImplementation((() => true) as never);
  return () => {
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(process.stderr, key, descriptor);
      else delete (process.stderr as unknown as Record<string, unknown>)[key];
    }
  };
}

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('the category spinner', () => {
  it('does not animate in a terminal that reports no width', () => {
    vi.useFakeTimers();
    const restore = terminal(0);
    const progress = new ProgressReporter({});
    try {
      progress.onCategoryStart('core', 'Core');
      expect(spinnerOf(progress)?.isEnabled ?? false).toBe(false);
    } finally {
      // Never let a spinner that did animate erase its Infinity lines on stop
      const spinner = spinnerOf(progress);
      if (spinner) spinner.isEnabled = false;
      progress.stop();
      restore();
    }
  });

  it('still animates in a terminal with a width', () => {
    vi.useFakeTimers();
    const restore = terminal(120);
    // The spinner also stays off under CI or TERM=dumb; this case is about width
    const env = { CI: process.env.CI, TERM: process.env.TERM };
    delete process.env.CI;
    process.env.TERM = 'xterm-256color';
    const progress = new ProgressReporter({});
    try {
      progress.onCategoryStart('core', 'Core');
      expect(spinnerOf(progress)?.isEnabled).toBe(true);
    } finally {
      progress.stop();
      restore();
      for (const [key, value] of Object.entries(env)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  });
});
