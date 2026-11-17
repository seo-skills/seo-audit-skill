/**
 * Polite crawling: rate limits, Crawl-delay, per-host limits, giving up on a
 * failing host, and a time limit. Driven against a local server.
 */
import { describe, it, expect, afterEach } from 'vitest';
import * as http from 'node:http';
import type { AddressInfo } from 'node:net';
import { Crawler, parseRetryAfter, type CrawlDelayNotice } from './crawler.js';
import { RobotsMatcher } from './robots.js';
import { evaluateGate } from '../gate.js';
import type { AuditResult } from '../types.js';

const servers: http.Server[] = [];
afterEach(() => {
  while (servers.length) servers.pop()!.close();
});

async function serve(handler: http.RequestListener): Promise<string> {
  const server = http.createServer(handler);
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

const html = (body: string) => `<html><head><title>t</title></head><body>${body}</body></html>`;
const links = (n: number) => Array.from({ length: n }, (_, i) => `<a href="/p${i}">p${i}</a>`).join('');

describe('Retry-After', () => {
  it('reads seconds and HTTP dates', () => {
    expect(parseRetryAfter('2')).toBe(2000);
    expect(parseRetryAfter(new Date(Date.now() + 5000).toUTCString())).toBeGreaterThan(3000);
    expect(parseRetryAfter('soon')).toBeNull();
    expect(parseRetryAfter(undefined)).toBeNull();
  });
});

describe('rate limits', () => {
  it('waits out two 429s and scores the page as the 200 it became', async () => {
    let hits = 0;
    const base = await serve((req, res) => {
      if (req.url === '/robots.txt') return void res.writeHead(404).end();
      hits++;
      if (hits <= 2) {
        res.writeHead(429, { 'retry-after': '1' });
        return void res.end('slow down');
      }
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end(html('ok'));
    });
    const crawler = new Crawler({ maxPages: 1, concurrency: 1 });
    const started = Date.now();
    const [page] = await crawler.crawl(`${base}/`);
    expect(page.context.statusCode).toBe(200);
    expect(page.error).toBeUndefined();
    expect(Date.now() - started).toBeGreaterThanOrEqual(1900);
  }, 15000);

  it('fails the run when the start page stays rate-limited, naming the host', async () => {
    const base = await serve((req, res) => {
      if (req.url === '/robots.txt') return void res.writeHead(404).end();
      res.writeHead(429, { 'retry-after': '0' });
      res.end();
    });
    const crawler = new Crawler({ maxPages: 1, concurrency: 1, backoffBaseMs: 10 });
    await expect(crawler.crawl(`${base}/`)).rejects.toMatchObject({ code: 'rate-limited' });
  }, 15000);

  it('records a page that stays rate-limited as rate-limited, never as a 4xx finding', async () => {
    const base = await serve((req, res) => {
      if (req.url === '/robots.txt') return void res.writeHead(404).end();
      if (req.url === '/') {
        res.writeHead(200, { 'content-type': 'text/html' });
        return void res.end(html('<a href="/busy">busy</a>'));
      }
      res.writeHead(429, { 'retry-after': '0' });
      res.end();
    });
    const crawler = new Crawler({ maxPages: 5, concurrency: 1, backoffBaseMs: 10 });
    const pages = await crawler.crawl(`${base}/`);
    const busy = pages.find((p) => p.url.endsWith('/busy'))!;
    expect(busy.rateLimited).toBe(true);
    expect(busy.error).toContain('rate-limited');
    expect(crawler.getReport().rateLimitedHosts[0].pages).toBe(1);
    expect(crawler.buildSiteContext().pages!.get(busy.url)!.rateLimited).toBe(true);
  }, 15000);
});

describe('giving up on a failing host', () => {
  it('stops after 10 failing pages in a row and leaves the rest not fetched', async () => {
    const base = await serve((req, res) => {
      if (req.url === '/robots.txt') return void res.writeHead(404).end();
      if (req.url === '/') {
        res.writeHead(200, { 'content-type': 'text/html' });
        return void res.end(html(links(30)));
      }
      res.writeHead(500);
      res.end('down');
    });
    const crawler = new Crawler({ maxPages: 40, concurrency: 1 });
    const pages = await crawler.crawl(`${base}/`);
    const report = crawler.getReport();
    expect(pages.length).toBe(11);
    expect(report.abandonedHosts).toEqual([new URL(base).host]);
    expect(report.notFetched.length).toBe(20);
  }, 15000);
});

describe('Crawl-delay', () => {
  it('spaces requests by the delay and says what it will cost', async () => {
    const starts: number[] = [];
    const base = await serve((req, res) => {
      if (req.url === '/robots.txt') {
        res.writeHead(200, { 'content-type': 'text/plain' });
        return void res.end('User-agent: *\nCrawl-delay: 1\n');
      }
      starts.push(Date.now());
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end(html(req.url === '/' ? links(2) : 'leaf'));
    });
    const notices: CrawlDelayNotice[] = [];
    const crawler = new Crawler({ maxPages: 3, concurrency: 3, onCrawlDelay: (n) => notices.push(n) });
    await crawler.crawl(`${base}/`);
    expect(notices[0]).toMatchObject({ delayMs: 1000, capped: false, projectedMs: 2000 });
    for (let i = 1; i < starts.length; i++) expect(starts[i] - starts[i - 1]).toBeGreaterThanOrEqual(950);
  }, 15000);

  it('caps a long delay at 10 s and reports the cap', async () => {
    const base = await serve((req, res) => {
      if (req.url === '/robots.txt') {
        res.writeHead(200, { 'content-type': 'text/plain' });
        return void res.end('User-agent: *\nCrawl-delay: 60\n');
      }
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end(html('only page'));
    });
    const notices: CrawlDelayNotice[] = [];
    await new Crawler({ maxPages: 1, onCrawlDelay: (n) => notices.push(n) }).crawl(`${base}/`);
    expect(notices[0]).toMatchObject({ delayMs: 10_000, requestedMs: 60_000, capped: true });
  });

  it('is skipped when the caller opts out', async () => {
    const base = await serve((req, res) => {
      if (req.url === '/robots.txt') {
        res.writeHead(200, { 'content-type': 'text/plain' });
        return void res.end('User-agent: *\nCrawl-delay: 5\n');
      }
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end(html('page'));
    });
    const crawler = new Crawler({ maxPages: 1, respectCrawlDelay: false });
    await crawler.crawl(`${base}/`);
    expect(crawler.getReport().crawlDelay).toBeNull();
  });
});

describe('robots.txt groups', () => {
  it('matches the product token, not any substring of the user-agent string', () => {
    const ua = 'SEOmatorBot/3.0 (+https://github.com/seo-skills/seo-audit-skill)';
    expect(new RobotsMatcher('User-agent: bot\nDisallow: /\n', ua).isAllowed('https://x.com/a')).toBe(true);
    expect(new RobotsMatcher('User-agent: seomator\nDisallow: /\n', ua).isAllowed('https://x.com/a')).toBe(false);
    expect(new RobotsMatcher('User-agent: SEOmatorBot\nCrawl-delay: 3\n', ua).crawlDelaySeconds).toBe(3);
  });
});

describe('per-host concurrency', () => {
  it('never has more requests in flight to one host than the limit', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const base = await serve(async (req, res) => {
      if (req.url === '/robots.txt') return void res.writeHead(404).end();
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 60));
      inFlight--;
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end(html(req.url === '/' ? links(6) : 'leaf'));
    });
    await new Crawler({ maxPages: 7, concurrency: 4, perHostConcurrency: 1 }).crawl(`${base}/`);
    expect(maxInFlight).toBe(1);
  }, 15000);
});

describe('time limit', () => {
  it('stops starting requests at the deadline and keeps what was fetched', async () => {
    const base = await serve(async (req, res) => {
      if (req.url === '/robots.txt') return void res.writeHead(404).end();
      await new Promise((r) => setTimeout(r, 150));
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end(html(req.url === '/' ? links(20) : 'leaf'));
    });
    const crawler = new Crawler({ maxPages: 21, concurrency: 1, deadline: Date.now() + 500 });
    const pages = await crawler.crawl(`${base}/`);
    const report = crawler.getReport();
    expect(report.stoppedByDeadline).toBe(true);
    expect(pages.length).toBeLessThan(21);
    expect(report.notFetched.length).toBeGreaterThan(0);
  }, 15000);
});

describe('not fetched, when the crawl is cut short', () => {
  it('counts no more pages than the page budget had left', async () => {
    const base = await serve(async (req, res) => {
      if (req.url === '/robots.txt') return void res.writeHead(404).end();
      await new Promise((r) => setTimeout(r, 120));
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end(html(req.url === '/' ? links(200) : 'leaf'));
    });
    const crawler = new Crawler({ maxPages: 20, concurrency: 1, deadline: Date.now() + 400 });
    const pages = await crawler.crawl(`${base}/`);
    const report = crawler.getReport();
    expect(report.stoppedByDeadline).toBe(true);
    expect(report.notFetched.length).toBe(20 - pages.length);
  }, 15000);
});

describe('page limit', () => {
  it('leaves nothing "not fetched" when the crawl stops at max pages', async () => {
    const base = await serve((req, res) => {
      if (req.url === '/robots.txt') return void res.writeHead(404).end();
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end(html(req.url === '/' ? links(10) : 'leaf'));
    });
    const crawler = new Crawler({ maxPages: 3, concurrency: 1 });
    const pages = await crawler.crawl(`${base}/`);
    expect(pages.length).toBe(3);
    expect(crawler.getReport().notFetched).toEqual([]);
  }, 15000);

  it('reports an audit that reached its page limit as complete, with full coverage', async () => {
    const { vi } = await import('vitest');
    const { Auditor } = await import('../auditor.js');
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const path = new URL(String(input instanceof Request ? input.url : input)).pathname;
        if (path === '/robots.txt' || path.endsWith('.xml')) return new Response('', { status: 404 });
        return new Response(html(path === '/' ? links(10) : 'leaf'), { headers: { 'content-type': 'text/html' } });
      })
    );
    try {
      const result = await new Auditor({ measureCwv: false, categories: ['core'] }).auditWithCrawl('https://site.test/', 3, 1);
      expect(result.coverage).toMatchObject({ attempted: 3, measured: 3, notFetched: 0 });
      expect(result.completionState).toBe('completed');
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('robots.txt that never finishes', () => {
  it('is given up after its 5 s timeout, body included, and the audit goes on', async () => {
    const base = await serve((req, res) => {
      if (req.url === '/robots.txt') {
        // Headers at once, then a byte at a time, never ending
        res.writeHead(200, { 'content-type': 'text/plain' });
        res.write('U');
        const drip = setInterval(() => res.write('s'), 200);
        res.on('close', () => clearInterval(drip));
        return;
      }
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end(html('leaf'));
    });
    const { Auditor } = await import('../auditor.js');
    const started = Date.now();
    const result = await new Auditor({ measureCwv: false, categories: ['core'] }).audit(`${base}/`);
    expect(result.overallScore).toBeGreaterThan(0);
    // gstack-timing-ok: the bound is the 5 s robots timeout plus slack, and an unbounded read never returns
    expect(Date.now() - started).toBeLessThan(12_000);
  }, 20000);
});

describe('cancelling during a rate-limit wait', () => {
  const tooManyRequests = (req: http.IncomingMessage, res: http.ServerResponse) => {
    if (req.url === '/robots.txt') return void res.writeHead(404).end();
    res.writeHead(429, { 'retry-after': '60' });
    res.end();
  };

  it('ends a single-page audit at once, not after the Retry-After', async () => {
    const base = await serve(tooManyRequests);
    const { Auditor } = await import('../auditor.js');
    const cancel = new AbortController();
    setTimeout(() => cancel.abort(), 200);
    const outcome = await Promise.race([
      new Auditor({ measureCwv: false, categories: ['core'], signal: cancel.signal }).audit(`${base}/`).then(
        () => 'finished',
        (error: Error) => error.name
      ),
      new Promise((resolve) => setTimeout(() => resolve('still waiting'), 3000)),
    ]);
    expect(outcome).toBe('AuditAbortedError');
  }, 10000);

  it('ends a crawl at once, not after the Retry-After', async () => {
    const base = await serve((req, res) => {
      if (req.url === '/') {
        res.writeHead(200, { 'content-type': 'text/html' });
        return void res.end(html(links(3)));
      }
      tooManyRequests(req, res);
    });
    const cancel = new AbortController();
    const crawler = new Crawler({ maxPages: 4, concurrency: 1, signal: cancel.signal });
    setTimeout(() => cancel.abort(), 300);
    const outcome = await Promise.race([
      crawler.crawl(`${base}/`).then(
        () => 'finished',
        (error: Error) => error.name
      ),
      new Promise((resolve) => setTimeout(() => resolve('still waiting'), 3000)),
    ]);
    expect(outcome).toBe('AuditAbortedError');
  }, 10000);
});

describe('coverage gate', () => {
  const result = (measured: number, attempted: number): AuditResult => ({
    url: 'https://example.com/',
    overallScore: 90,
    timestamp: '',
    crawledPages: attempted,
    categoryResults: [],
    coverage: { pages: [], detail: 'per-page', measured, attempted },
  });

  it('exits 1 below the threshold and says how much was measured', () => {
    const gate = evaluateGate(result(40, 500), { failUnder: 70, minCoverage: 90 });
    expect(gate.exitCode).toBe(1);
    expect(gate.reason).toContain('measured 40 of 500 pages; min-coverage 90');
  });

  it('is off by default', () => {
    expect(evaluateGate(result(40, 500), { failUnder: 70 }).exitCode).toBe(0);
  });
});
