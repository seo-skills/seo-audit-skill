// Regression: ISSUE-010 — --refresh and --resume advertised features that do not exist
// Found by /qa on 2026-09-04
// Report: .gstack/qa-reports/qa-report-cli-config-2026-09-04b.md
//
// `--refresh` promises "Ignore cache, fetch all pages fresh". There is no
// cache: `LinkCache` is never instantiated outside its own test, and no rule
// fetches an external link, so nothing is cached to ignore.
//
// `--resume` promises "Resume interrupted crawl" from the `frontier` table,
// which `schema.ts` creates with two indexes and no code ever writes to.
//
// Both were listed in `--help` on `audit` and `crawl`. They stay parseable so
// existing scripts keep working — they were getting a full fresh crawl, which
// is still what they get — but they no longer advertise themselves, and using
// one says so.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { warnUnimplementedFlags, UNIMPLEMENTED_FLAGS } from './unimplemented-flags.js';

afterEach(() => vi.restoreAllMocks());

describe('a caller who passes one is told it does nothing', () => {
  it('warns for --refresh', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    warnUnimplementedFlags({ refresh: true });
    expect(err).toHaveBeenCalledWith(expect.stringContaining('--refresh'));
    expect(err).toHaveBeenCalledWith(expect.stringContaining('no effect'));
  });

  it('warns for --resume', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    warnUnimplementedFlags({ resume: true });
    expect(err).toHaveBeenCalledWith(expect.stringContaining('--resume'));
  });

  it('warns once per flag when both are passed', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    warnUnimplementedFlags({ refresh: true, resume: true });
    expect(err).toHaveBeenCalledTimes(2);
  });

  it('says nothing when neither is passed', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    warnUnimplementedFlags({ verbose: true, crawl: false });
    expect(err).not.toHaveBeenCalled();
  });

  it('does not fire on a falsy value, which is the default', () => {
    // Commander defaults both to false, so every run carries the key.
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    warnUnimplementedFlags({ refresh: false, resume: false });
    expect(err).not.toHaveBeenCalled();
  });

  it('warns on stderr, so a redirected report is still only the report', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    warnUnimplementedFlags({ refresh: true });
    expect(err).toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
  });
});

describe('the flags are not advertised', () => {
  const cli = readFileSync(new URL('../cli.ts', import.meta.url).pathname, 'utf8');

  it('registers them hidden rather than as documented options', () => {
    // A `.option('-r, --refresh', 'Ignore cache, ...')` line is what put a
    // promise of caching into `--help` on two commands.
    expect(cli).not.toMatch(/\.option\(\s*'-r, --refresh'/);
    expect(cli).not.toMatch(/\.option\(\s*'--resume'/);
    expect(cli).toMatch(/hideHelp\(\)/);
  });

  it('still accepts them, so a script passing one keeps running', () => {
    // Removing the options outright would make Commander exit with "unknown
    // option" on a command line that used to work.
    expect(cli).toMatch(/new Option\('-r, --refresh'\)/);
    expect(cli).toMatch(/new Option\('--resume'\)/);
  });

  it('keeps both flags in one list, so neither is half-removed', () => {
    expect(UNIMPLEMENTED_FLAGS.map((f) => f.key).sort()).toEqual(['refresh', 'resume']);
  });
});
