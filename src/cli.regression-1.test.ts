// Regression: ISSUE-001 — `seomator audit` rendered every page in a browser by default
// Found by /qa on 2026-11-11
// Report: .gstack/qa-reports/run-20261111T093935Z/qa-report-seomator-audit-2026-11-11.md
//
// `--no-cwv` was the only declaration, and Commander gives a lone `--no-x`
// option a default of true. So every plain `seomator audit` launched headless
// Chrome to measure Core Web Vitals: 8.6s with a cold browser and 1.3s warm on a
// local page that audits in 0.4s without it, and once per page under --crawl.
// `serve --audit` declared it the same way. The render is asked for with
// `--cwv` now, and `--no-cwv` still parses so existing scripts keep working.
//
// This parses real argv through the real program in cli.ts, with only the
// command handlers mocked. The default lives in the option declarations, and a
// copy of those declarations would only test the copy.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const handlers = vi.hoisted(() => ({
  runAudit: vi.fn(),
  runServe: vi.fn(),
}));

vi.mock('./commands/index.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./commands/index.js')>()),
  runAudit: handlers.runAudit,
}));

// `serve` imports its handler lazily, inside the action
vi.mock('./commands/serve.js', () => ({ runServe: handlers.runServe }));

const originalArgv = process.argv;

/** Run cli.ts as if invoked as `seomator <args>`, and return the options the handler got */
async function parse(...args: string[]): Promise<Record<string, unknown>> {
  process.argv = ['node', 'seomator', ...args];
  vi.resetModules();
  await import('./cli.js');
  if (args[0] === 'serve') {
    await vi.waitFor(() => expect(handlers.runServe).toHaveBeenCalledTimes(1));
    return handlers.runServe.mock.calls[0][0];
  }
  expect(handlers.runAudit).toHaveBeenCalledTimes(1);
  return handlers.runAudit.mock.calls[0][1];
}

beforeEach(() => {
  handlers.runAudit.mockReset();
  handlers.runServe.mockReset();
});

afterEach(() => {
  process.argv = originalArgv;
});

describe('the browser render is opt-in', () => {
  // `undefined` and `false` are kept apart on purpose: "not asked" and "asked
  // not to" are different requests once other flags can need a render.
  const cases: Array<{ argv: string[]; cwv: boolean | undefined }> = [
    { argv: ['audit', 'https://example.com'], cwv: undefined },
    { argv: ['audit', 'https://example.com', '--cwv'], cwv: true },
    { argv: ['audit', 'https://example.com', '--no-cwv'], cwv: false },
    { argv: ['serve', '--no-open', '--audit', 'https://example.com'], cwv: undefined },
    { argv: ['serve', '--no-open', '--audit', 'https://example.com', '--cwv'], cwv: true },
    { argv: ['serve', '--no-open', '--audit', 'https://example.com', '--no-cwv'], cwv: false },
  ];

  for (const { argv, cwv } of cases) {
    it(`seomator ${argv.join(' ')} → cwv ${String(cwv)}`, async () => {
      const options = await parse(...argv);
      expect(options['cwv']).toBe(cwv);
    });
  }
});
