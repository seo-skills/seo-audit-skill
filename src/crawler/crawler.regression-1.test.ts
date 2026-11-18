// Regression: ISSUE-001 — a crawl of a site that does not answer was scored 0 and exited 1
// Found by /qa on 2026-11-18
// Report: .gstack/qa-reports/run-20261118T115906Z/qa-report-seomator-cli-2026-11-18.md
//
// A single-page audit of a dead site fails with `unreachable` and exits 2: the
// run could not happen. The same site with --crawl recorded the start page's
// connection failure as an ordinary failed page, scored the result 0 and exited
// 1, so CI read "the site got worse" instead of "the job is broken". A start page
// that cannot be loaded now fails the crawl the way it fails a single page.
import { describe, it, expect } from 'vitest';
import * as net from 'node:net';
import type { AddressInfo } from 'node:net';
import { Auditor } from '../auditor.js';
import { Crawler } from './crawler.js';
import { classifyError } from '../errors.js';

/** A local port with nothing listening on it */
async function closedPort(): Promise<number> {
  const server = net.createServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return port;
}

describe('a crawl whose start page cannot be reached', () => {
  it('fails as unreachable, like a single page, instead of scoring the failure', async () => {
    const url = `http://127.0.0.1:${await closedPort()}/`;
    const error = await new Auditor({ measureCwv: false, categories: ['core'] }).auditWithCrawl(url, 5, 1).then(
      () => null,
      (reason: unknown) => reason
    );
    expect(error).not.toBeNull();
    expect(classifyError(error).code).toBe('unreachable');
  });

  it('fails the crawler itself, so `seomator crawl` does not report it complete', async () => {
    const url = `http://127.0.0.1:${await closedPort()}/`;
    await expect(new Crawler({ maxPages: 5, concurrency: 1 }).crawl(url)).rejects.toBeTruthy();
  });
});
