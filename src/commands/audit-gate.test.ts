/**
 * The CI gates end to end: a real `runAudit` against a local page, with a
 * config file on disk, reading what a CI job reads (stdout, stderr, the exit
 * code).
 */
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import * as http from 'node:http';
import type { AddressInfo } from 'node:net';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runAudit, type AuditOptions } from './audit.js';

// No description, no canonical: two rules that fail deterministically.
const PAGE = `<!doctype html><html lang="en"><head><title>Gate fixture page</title>
<meta name="viewport" content="width=device-width"></head>
<body><h1>Gate fixture</h1><p>${'Some words. '.repeat(60)}</p></body></html>`;

let server: http.Server;
let url: string;
let dir: string;

beforeAll(async () => {
  server = http.createServer((req, res) => {
    if (req.url === '/') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(PAGE);
      return;
    }
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found');
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`;
  dir = mkdtempSync(join(tmpdir(), 'seomator-gate-'));
});

afterAll(() => {
  server.close();
  rmSync(dir, { recursive: true, force: true });
});

afterEach(() => {
  vi.restoreAllMocks();
  process.exitCode = undefined;
});

function options(overrides: Partial<AuditOptions>): AuditOptions {
  return {
    json: false,
    crawl: false,
    maxPages: 1,
    concurrency: 1,
    timeout: 5000,
    verbose: false,
    refresh: false,
    resume: false,
    save: false,
    format: 'json',
    ...overrides,
  };
}

async function run(toml: string, extra: Partial<AuditOptions> = {}) {
  const configPath = join(dir, `seomator-${Math.random().toString(36).slice(2)}.toml`);
  writeFileSync(configPath, toml);
  const stdout: string[] = [];
  const stderr: string[] = [];
  vi.spyOn(console, 'log').mockImplementation((...args) => void stdout.push(args.join(' ')));
  vi.spyOn(console, 'error').mockImplementation((...args) => void stderr.push(args.join(' ')));
  await runAudit(url, options({ config: configPath, ...extra }));
  const exitCode = process.exitCode;
  vi.restoreAllMocks();
  return { stdout: stdout.join('\n'), stderr: stderr.join('\n'), exitCode };
}

describe('CI gates', () => {
  it('a typo in a fail_ci rule id stops the run with exit 2 and a suggestion', async () => {
    const { stdout, exitCode } = await run('[rules.override]\n"core-canonical-presnt" = { fail_ci = true }\n');
    expect(exitCode).toBe(2);
    const payload = JSON.parse(stdout);
    expect(payload.code).toBe('config');
    expect(payload.message).toContain('Did you mean "core-canonical-present"?');
  });

  it('a failing fail_ci rule exits 1 at any score, keeps stdout parseable and says why last', async () => {
    const { stdout, stderr, exitCode } = await run(
      '[rules.override]\n"core-canonical-present" = { fail_ci = true }\n',
      { failUnder: 0 }
    );
    expect(exitCode).toBe(1);
    const payload = JSON.parse(stdout);
    expect(payload.schemaVersion).toBe(3);
    expect(payload.gate.failedCiRules[0].ruleId).toBe('core-canonical-present');
    expect(payload.gate.exitCode).toBe(1);
    expect(stderr.trim().split('\n').at(-1)).toMatch(/^.*Exit 1: core-canonical-present failed \(fail_ci\); score \d+ passed fail-under 0/);
  }, 30000);

  it('--fail-under 0 passes a run with no gated rule, and [ci] fail_under is the fallback', async () => {
    const passing = await run('', { failUnder: 0 });
    expect(passing.exitCode).toBe(0);
    expect(JSON.parse(passing.stdout).gate).toMatchObject({ failUnder: 0, exitCode: 0 });

    const strict = await run('[ci]\nfail_under = 100\n');
    expect(strict.exitCode).toBe(1);
    expect(JSON.parse(strict.stdout).gate.failUnder).toBe(100);
  }, 30000);

  it('ignore hides a finding without changing the score', async () => {
    const plain = await run('', { failUnder: 0 });
    const ignored = await run('[rules.override]\n"core-description-present" = { priority = "ignore" }\n', {
      failUnder: 0,
    });
    const a = JSON.parse(plain.stdout);
    const b = JSON.parse(ignored.stdout);
    expect(b.overallScore).toBe(a.overallScore);
    const marked = b.categoryResults
      .flatMap((c: { results: Array<{ ruleId: string; overridden?: unknown }> }) => c.results)
      .find((r: { ruleId: string }) => r.ruleId === 'core-description-present');
    expect(marked.overridden).toEqual({ priority: 'ignore' });
  }, 30000);

  it('a gated rule left out by --categories is a config error', async () => {
    const { exitCode, stdout } = await run('[rules.override]\n"core-canonical-present" = { fail_ci = true }\n', {
      categories: ['perf'],
    });
    expect(exitCode).toBe(2);
    expect(JSON.parse(stdout).message).toContain('--categories leaves out');
  });
});
