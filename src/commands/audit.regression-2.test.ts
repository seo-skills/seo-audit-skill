// Regression: ISSUE-004 — seomator.toml [output] was parsed and then ignored
//             ISSUE-005 — `-o reports/audit.json` failed with a bare ENOENT
// Found by /qa on 2026-09-04
// Report: .gstack/qa-reports/qa-report-127-0-0-1-2026-09-04.md
//
// `seomator init --preset ci` writes `format = "json"` and
// `path = "reports/audit.json"`. Running an audit in that directory printed the
// coloured console banner on stdout and created no file: the format was
// resolved on the line above the `loadConfig()` call, so the file was read,
// validated, displayed by `seomator config`, and never consulted.
//
// Fixing that exposed the second bug. Nothing created the report's parent
// directory, so the path the preset itself ships could not be written even
// when it was finally honoured.
import { describe, it, expect, vi } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveOutputTarget, writeReport } from './audit.js';
import type { OutputConfig } from '../config/schema.js';

/** The shape `loadConfig` returns when the user wrote no `[output]` section. */
const DEFAULT_OUTPUT: OutputConfig = { format: 'console', path: '', save: false };

/** What `init --preset ci` writes. */
const CI_OUTPUT: OutputConfig = {
  format: 'json',
  path: 'reports/audit.json',
  save: false,
};

describe('ISSUE-004 — the config file decides output when no flag does', () => {
  it('honours [output] format from the config file', () => {
    expect(resolveOutputTarget({}, CI_OUTPUT).format).toBe('json');
  });

  it('honours [output] path from the config file', () => {
    expect(resolveOutputTarget({}, CI_OUTPUT).path).toBe('reports/audit.json');
  });

  it('still defaults to console with no flag and no config', () => {
    const { format, path } = resolveOutputTarget({}, DEFAULT_OUTPUT);
    expect(format).toBe('console');
    expect(path).toBeUndefined();
  });

  it('treats an empty config path as "no path", not as a file called ""', () => {
    // `path: ''` is the schema default. Passing it through would make every
    // run try to write a file with an empty name.
    expect(resolveOutputTarget({}, { ...CI_OUTPUT, path: '' }).path).toBeUndefined();
  });
});

describe('ISSUE-004 — a flag still beats the config file', () => {
  it('--format overrides [output] format', () => {
    expect(resolveOutputTarget({ format: 'markdown' }, CI_OUTPUT).format).toBe('markdown');
  });

  it('-o overrides [output] path', () => {
    expect(resolveOutputTarget({ output: 'mine.json' }, CI_OUTPUT).path).toBe('mine.json');
  });

  it('drops the config path when a flag changes the format, so --format still streams', () => {
    // Keeping the path here wrote a markdown report into a file called
    // `audit.json` and left stdout empty, which is the bug ISSUE-002 fixed.
    const { format, path } = resolveOutputTarget({ format: 'markdown' }, CI_OUTPUT);
    expect(format).toBe('markdown');
    expect(path).toBeUndefined();
  });

  it('keeps the config path when the caller overrides nothing', () => {
    expect(resolveOutputTarget({}, CI_OUTPUT).path).toBe('reports/audit.json');
  });

  it('honours -o together with --format, so a file is still reachable', () => {
    const { format, path } = resolveOutputTarget({ format: 'markdown', output: 'r.md' }, CI_OUTPUT);
    expect(format).toBe('markdown');
    expect(path).toBe('r.md');
  });

  it('drops the config path for --json too, not just --format', () => {
    expect(resolveOutputTarget({ json: true }, CI_OUTPUT).path).toBeUndefined();
  });

  it('--format beats --json, which beats the config file', () => {
    expect(resolveOutputTarget({ format: 'llm', json: true }, CI_OUTPUT).format).toBe('llm');
    expect(resolveOutputTarget({ json: true }, { ...CI_OUTPUT, format: 'html' }).format).toBe(
      'json'
    );
  });

  it('maps the config-only "text" format onto console rather than failing', () => {
    // `text` is valid in OutputConfig and is not a CLI format. Passing it
    // through would reach the renderer switch as an unhandled case.
    expect(resolveOutputTarget({}, { ...DEFAULT_OUTPUT, format: 'text' }).format).toBe('console');
  });
});

describe('ISSUE-005 — a report path may name a directory that does not exist yet', () => {
  it('creates the parent directory before writing', () => {
    const dir = mkdtempSync(join(tmpdir(), 'seomator-mkdir-'));
    const out = join(dir, 'reports', 'audit.json');
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      // Pre-fix this threw ENOENT: the exact default path `--preset ci` ships.
      expect(() => writeReport(out, '{"ok":true}', 'Report')).not.toThrow();
      expect(existsSync(out)).toBe(true);
      expect(JSON.parse(readFileSync(out, 'utf8'))).toEqual({ ok: true });
    } finally {
      err.mockRestore();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('creates nested directories, not just one level', () => {
    const dir = mkdtempSync(join(tmpdir(), 'seomator-mkdir-'));
    const out = join(dir, 'a', 'b', 'c', 'report.md');
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      writeReport(out, '# report', 'Markdown report');
      expect(readFileSync(out, 'utf8')).toBe('# report');
    } finally {
      err.mockRestore();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('writes a bare filename in the working directory without inventing a directory', () => {
    const dir = mkdtempSync(join(tmpdir(), 'seomator-mkdir-'));
    const cwd = process.cwd();
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      process.chdir(dir);
      writeReport('report.json', '{}', 'Report');
      expect(existsSync(join(dir, 'report.json'))).toBe(true);
    } finally {
      process.chdir(cwd);
      err.mockRestore();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
