/**
 * `seomator crawl` runs under the same network policy as `audit`, and honours
 * the [crawler] keys that shape a polite crawl.
 */
import { describe, it, expect, afterAll } from 'vitest';
import * as http from 'node:http';
import type { AddressInfo } from 'node:net';
import { getDefaultConfig } from '../config/defaults.js';
import { crawlerOptionsFor, crawlSite } from './crawl.js';

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
    const pages = await crawlSite(`http://127.0.0.1:${sitePort}/`, config, 5);
    expect(pages.find((page) => page.url.endsWith('/hop'))?.error).toBeTruthy();
    expect(reachedPrivate).toBe(0);
  }, 20000);
});
