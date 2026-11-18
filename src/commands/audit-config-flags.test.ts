/**
 * `audit` used to pass its flag defaults to the config loader as overrides,
 * so `[crawler] max_pages`, `concurrency` and `timeout_ms` in seomator.toml
 * never reached it. Only a flag the user typed overrides the file now.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import * as http from 'node:http';
import type { AddressInfo } from 'node:net';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runAudit, type AuditOptions } from './audit.js';

afterEach(() => {
  vi.restoreAllMocks();
  process.exitCode = undefined;
});

async function crawlRun(toml: string, explicitFlags: AuditOptions['explicitFlags'], maxPages = 10) {
  const links = Array.from({ length: 80 }, (_, i) => `<a href="/p${i}">p${i}</a>`).join('');
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(req.url === '/' ? `<html><head><title>Home</title></head><body>${links}</body></html>` : `<html><head><title>${req.url}</title></head><body>leaf</body></html>`);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`;
  const configPath = join(mkdtempSync(join(tmpdir(), 'seomator-flags-')), 'seomator.toml');
  writeFileSync(configPath, toml);
  const out: string[] = [];
  vi.spyOn(console, 'log').mockImplementation((...a) => void out.push(a.join(' ')));
  vi.spyOn(console, 'error').mockImplementation(() => {});
  try {
    await runAudit(url, {
      json: false, crawl: true, maxPages, concurrency: 3, timeout: 30000, verbose: false,
      refresh: false, resume: false, save: false, format: 'json', failUnder: 0, config: configPath,
      explicitFlags,
    });
  } finally {
    vi.restoreAllMocks();
    server.close();
  }
  return JSON.parse(out.join('\n'));
}

describe('audit reads [crawler] from seomator.toml', () => {
  it('uses max_pages from the file when -m is not typed', async () => {
    const result = await crawlRun('[crawler]\nmax_pages = 15\ndelay_ms = 0\nper_host_delay_ms = 0\n', {});
    expect(result.run.maxPages).toBe(15);
    expect(result.crawledPages).toBe(15);
  }, 60000);

  it('lets a typed -m win over the file', async () => {
    const result = await crawlRun('[crawler]\nmax_pages = 15\ndelay_ms = 0\nper_host_delay_ms = 0\n', { maxPages: true }, 4);
    expect(result.run.maxPages).toBe(4);
  }, 60000);
});
