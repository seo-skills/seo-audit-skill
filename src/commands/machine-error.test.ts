// Regression: ISSUE-015 — machine-mode errors produced empty stdout
//             ISSUE-016 — `report --format json` printed prose and exited 0
//             ISSUE-017 — compare exited past the finally that closes its database
// Found by /qa on 2026-09-04
// Report: .gstack/qa-reports/qa-report-cli-agent-2026-09-04.md
//
// `audit --format json` has always emitted `{"error": true, "code": …}` on a
// failure. The other three machine surfaces did not:
//
//   analyze --json (missing crawl)   exit=1   (empty stdout)
//   compare --json (unknown domain)  exit=1   (empty stdout)
//   report  --format json (no match) exit=0   "No audits stored yet. Run ..."
//
// An agent could not tell a missing crawl from a crash, and the `report` case
// was worse than useless: prose on stdout under a success exit code, so the
// parse failed while the status said everything was fine. It also claimed
// nothing was stored when audits existed and a `--project` filter excluded them.
//
// Those paths used `process.exit(1)`, which skips `finally` blocks. Three of
// compare's sat inside the try whose finally calls `closeAuditsDatabase()`, so
// the handle was never closed — a comment on a fourth path already said so.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { emitCommandError } from './machine-error.js';

afterEach(() => {
  vi.restoreAllMocks();
  process.exitCode = 0;
});

/** Capture stdout and stderr around one call. */
function capture(fn: () => void): { out: string; err: string } {
  const log = vi.spyOn(console, 'log').mockImplementation(() => {});
  const error = vi.spyOn(console, 'error').mockImplementation(() => {});
  fn();
  return {
    out: log.mock.calls.flat().join('\n'),
    err: error.mock.calls.flat().join('\n'),
  };
}

describe('machine mode gets a parseable error object', () => {
  it('writes JSON to stdout that an agent can parse', () => {
    const { out } = capture(() =>
      emitCommandError({ json: true, code: 'crawl-not-found', message: 'Crawl not found: x' })
    );

    const parsed = JSON.parse(out);
    expect(parsed.error).toBe(true);
    expect(parsed.code).toBe('crawl-not-found');
    expect(parsed.message).toBe('Crawl not found: x');
    expect(parsed.timestamp).toEqual(expect.any(String));
  });

  it('carries the hint, so the agent can act rather than just report', () => {
    const { out } = capture(() =>
      emitCommandError({ json: true, code: 'no-audits', message: 'none', hint: 'run an audit' })
    );
    expect(JSON.parse(out).hint).toBe('run an audit');
  });

  it('omits hint entirely when there is none, rather than emitting undefined', () => {
    const { out } = capture(() =>
      emitCommandError({ json: true, code: 'no-audits', message: 'none' })
    );
    expect('hint' in JSON.parse(out)).toBe(false);
  });

  it('keeps stderr clear in machine mode, so stdout is the whole story', () => {
    const { err } = capture(() =>
      emitCommandError({ json: true, code: 'x', message: 'y', hint: 'z' })
    );
    expect(err).toBe('');
  });
});

describe('human mode still reads like an error', () => {
  it('writes the message and hint to stderr, not stdout', () => {
    const { out, err } = capture(() =>
      emitCommandError({ json: false, code: 'crawl-not-found', message: 'Crawl not found: x', hint: 'try this' })
    );

    expect(out).toBe('');
    expect(err).toContain('Crawl not found: x');
    expect(err).toContain('try this');
  });

  it('does not leak JSON into a terminal', () => {
    const { err } = capture(() =>
      emitCommandError({ json: false, code: 'c', message: 'm' })
    );
    expect(err).not.toContain('"error"');
  });
});

describe('the exit code is set, never exited', () => {
  it('defaults to 1, which is what these paths already used', () => {
    capture(() => emitCommandError({ json: true, code: 'c', message: 'm' }));
    expect(process.exitCode).toBe(1);
  });

  it('accepts an explicit code', () => {
    capture(() => emitCommandError({ json: true, code: 'c', message: 'm', exitCode: 2 }));
    expect(process.exitCode).toBe(2);
  });

  it('returns instead of exiting, so finally blocks and stdout drain still run', () => {
    // process.exit() would have ended the process here and skipped both the
    // assertion below and, in compare, closeAuditsDatabase().
    let reachedFinally = false;
    try {
      capture(() => emitCommandError({ json: true, code: 'c', message: 'm' }));
    } finally {
      reachedFinally = true;
    }
    expect(reachedFinally).toBe(true);
  });
});
