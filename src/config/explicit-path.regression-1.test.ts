// Regression: ISSUE-007 — `--config <path>` was accepted and ignored
// Found by /qa on 2026-09-04
// Report: .gstack/qa-reports/qa-report-127-0-0-1-2026-09-04.md
//
// `cli.ts` declares `--config <path>` and `AuditOptions` declares `config?:
// string`. Nothing read it: `loadConfig()` only ever searched upward from the
// working directory, so pointing the CLI at `ci/audit.toml` audited with
// defaults and reported nothing unusual.
//
// The second half is the failure mode a typo produces. Once the flag was
// honoured, a path that does not exist has to say so — falling back to the
// search would put us back where we started, and throwing outside the
// command's error handling printed a Node stack trace and exited 1 where
// every other error in `audit` gives a message, a hint and exit 2.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig } from './loader.js';
import { AuditError } from '../errors.js';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'seomator-cfgpath-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('--config names a file instead of searching for one', () => {
  it('reads a config the upward search would never find', () => {
    mkdirSync(join(dir, 'elsewhere'));
    writeFileSync(
      join(dir, 'elsewhere', 'ci.toml'),
      '[output]\nformat = "json"\npath = "from-flag.json"\n'
    );

    const { config, configPath } = loadConfig(dir, {}, 'elsewhere/ci.toml');

    expect(config.output.format).toBe('json');
    expect(config.output.path).toBe('from-flag.json');
    expect(configPath).toContain('ci.toml');
  });

  it('resolves the path relative to the working directory', () => {
    writeFileSync(join(dir, 'other.toml'), '[project]\nname = "named"\n');
    expect(loadConfig(dir, {}, 'other.toml').config.project.name).toBe('named');
  });

  it('takes the named file over a seomator.toml sitting right there', () => {
    // Without this, the flag would be decorative whenever a default config
    // also existed, which is the common case in a repo.
    writeFileSync(join(dir, 'seomator.toml'), '[project]\nname = "default-file"\n');
    writeFileSync(join(dir, 'other.toml'), '[project]\nname = "named-file"\n');

    expect(loadConfig(dir, {}, 'other.toml').config.project.name).toBe('named-file');
    expect(loadConfig(dir, {}).config.project.name).toBe('default-file');
  });

  it('still lets CLI overrides win over the named file', () => {
    writeFileSync(join(dir, 'other.toml'), '[crawler]\nmax_pages = 7\n');

    const { config } = loadConfig(dir, { crawler: { max_pages: 42 } }, 'other.toml');

    expect(config.crawler.max_pages).toBe(42);
  });
});

describe('a --config path that does not exist fails loudly', () => {
  it('throws rather than silently auditing with defaults', () => {
    expect(() => loadConfig(dir, {}, 'missing.toml')).toThrow(/Config file not found/);
  });

  it('names the path the caller typed, not the resolved one', () => {
    // The absolute path is noise when the point is "you typed this wrong".
    expect(() => loadConfig(dir, {}, 'missing.toml')).toThrow(/missing\.toml/);
  });

  it('is an AuditError with a config code, so machine output can act on it', () => {
    // A bare Error classified as `unknown`, and escaped the command's handler
    // entirely: a stack trace on stdout instead of a JSON error object.
    try {
      loadConfig(dir, {}, 'missing.toml');
      expect.unreachable('loadConfig should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(AuditError);
      expect((error as AuditError).code).toBe('config');
      expect((error as AuditError).hint).toMatch(/--config/);
    }
  });

  it('leaves the no-flag path alone, which must not throw when nothing is found', () => {
    expect(() => loadConfig(dir, {})).not.toThrow();
    expect(loadConfig(dir, {}).configPath).toBeNull();
  });
});
