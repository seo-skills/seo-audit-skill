/**
 * `seomator crawl` runs under the same network policy as `audit`, and honours
 * the [crawler] keys that shape a polite crawl.
 */
import { describe, it, expect, afterAll, vi } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as http from 'node:http';
import type { AddressInfo } from 'node:net';
import { getDefaultConfig } from '../config/defaults.js';
import { crawlerOptionsFor, crawlSite, crawlWarnings, runCrawl } from './crawl.js';

const servers: http.Server[] = [];
afterAll(() => servers.forEach((server) => server.close()));

function listen(handler: http.RequestListener, host: string): Promise<number> {
  const server = http.createServer(handler);
  servers.push(server);
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, host, () => resolve((server.address() as AddressInfo).port));
  });
}

describe('crawlerOptionsFor', () => {
  it('passes every politeness key the config sets', () => {
    const config = getDefaultConfig();
    config.crawler.per_host_concurrency = 3;
    config.crawler.respect_crawl_delay = false;
    config.crawler.max_retry_after_ms = 30_000;
    config.crawler.max_duration_s = 60;
    const options = crawlerOptionsFor(config, 25, 1_000);
    expect(options).toMatchObject({
      maxPages: 25,
      perHostConcurrency: 3,
      respectCrawlDelay: false,
      maxRetryAfterMs: 30_000,
      deadline: 61_000,
    });
  });

  it('sets no deadline when max_duration_s is 0', () => {
    const config = getDefaultConfig();
    config.crawler.max_duration_s = 0;
    expect(crawlerOptionsFor(config, 10).deadline).toBeUndefined();
  });
});

describe('crawlSite', () => {
  it('refuses a redirect from a crawled page to another private address', async (ctx) => {
    let reachedPrivate = 0;
    const privatePort = await listen((_req, res) => {
      reachedPrivate++;
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end('<html><head><title>internal</title></head><body>internal</body></html>');
    }, '::1').catch(() => null);
    if (privatePort === null) return ctx.skip(); // no IPv6 loopback on this machine

    const sitePort = await listen((req, res) => {
      if (req.url === '/robots.txt') return void res.writeHead(404).end();
      if (req.url === '/hop') {
        res.writeHead(302, { location: `http://[::1]:${privatePort}/metadata` });
        return void res.end();
      }
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end('<html><head><title>site</title></head><body><a href="/hop">hop</a></body></html>');
    }, '127.0.0.1');

    const config = getDefaultConfig();
    config.crawler.timeout_ms = 5000;
    const { pages } = await crawlSite(`http://127.0.0.1:${sitePort}/`, config, 5);
    expect(pages.find((page) => page.url.endsWith('/hop'))?.error).toBeTruthy();
    expect(reachedPrivate).toBe(0);
  }, 20000);
});

describe('a crawl cut short', () => {
  it('reports the time limit, and the pages it left', async () => {
    const port = await listen(async (req, res) => {
      if (req.url === '/robots.txt') return void res.writeHead(404).end();
      await new Promise((r) => setTimeout(r, 300));
      const links = Array.from({ length: 20 }, (_, i) => `<a href="/p${i}">p${i}</a>`).join('');
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end(`<html><head><title>t</title></head><body>${req.url === '/' ? links : 'leaf'}</body></html>`);
    }, '127.0.0.1');
    const config = getDefaultConfig();
    config.crawler.max_duration_s = 1;
    config.crawler.concurrency = 1;
    const { pages, report } = await crawlSite(`http://127.0.0.1:${port}/`, config, 20);
    expect(report.stoppedByDeadline).toBe(true);
    const warnings = crawlWarnings(report, pages.length);
    expect(warnings.join('\n')).toMatch(/time limit/);
    expect(warnings.join('\n')).toContain(`${report.notFetched.length}`);
  }, 20000);

  it('says nothing for a crawl that finished', () => {
    expect(crawlWarnings({ rateLimitedPages: [], rateLimitedHosts: [], notFetched: [], abandonedHosts: [], crawlDelay: null, stoppedByDeadline: false }, 5)).toEqual([]);
  });
});

describe('runCrawl', () => {
  it('refuses an invalid config before requesting anything, as audit does', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'seomator-crawl-config-'));
    writeFileSync(join(dir, 'seomator.toml'), '[crawler]\nper_host_concurrency = 0\n');
    let requests = 0;
    const port = await listen((_req, res) => {
      requests++;
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end('<html><head><title>t</title></head><body>x</body></html>');
    }, '127.0.0.1');
    vi.spyOn(process, 'cwd').mockReturnValue(dir);
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit');
    }) as never);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const errors: string[] = [];
    vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => void errors.push(args.join(' ')));
    try {
      await expect(runCrawl(`http://127.0.0.1:${port}/`, { refresh: false, resume: false, verbose: false, output: dir })).rejects.toThrow('process.exit');
      expect(exit).toHaveBeenCalledWith(2);
      expect(errors.join('\n')).toMatch(/per_host_concurrency/);
      expect(requests).toBe(0);
    } finally {
      vi.restoreAllMocks();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
