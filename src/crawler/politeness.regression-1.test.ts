// Regression: ISSUE-009 — crawler.delay_ms and per_host_delay_ms did nothing
// Found by /qa on 2026-09-04
// Report: .gstack/qa-reports/qa-report-127-0-0-1-2026-09-04.md
//
// Both keys are declared in `CrawlerConfig`, given defaults (100 and 200),
// range-validated by `validateConfig`, and written by `init --preset ci`. No
// crawler code read either one: the only `delayMs` in `src/` belongs to
// `save-audit.ts` retry backoff. A config asking for a 2s gap between requests
// crawled a stranger's site at full concurrency, which is the one config
// setting whose failure lands on someone other than the user.
//
// Measured against a local 12-page site before the fix: identical 756ms with
// `per_host_delay_ms = 0` and with `= 300`.
//
// The second half is the concurrency trap. Reading "time of last request" and
// comparing it against now lets every worker read the same value and start
// together, so a delay silently becomes no delay at concurrency > 1. Each
// worker has to reserve its slot synchronously instead.
import { describe, it, expect, vi } from 'vitest';
import * as cheerio from 'cheerio';
import { Crawler } from './crawler.js';

const HTML = `<html><head><title>t</title></head><body>
<a href="/a">a</a><a href="/b">b</a><a href="/c">c</a><a href="/d">d</a>
</body></html>`;

/** Records when each fetch began, so gaps between requests are measurable. */
function makeTimedFetcher(startTimes: number[]) {
  return vi.fn(async () => {
    startTimes.push(Date.now());
    return {
      html: HTML,
      $: cheerio.load(HTML),
      headers: { 'content-type': 'text/html' },
      statusCode: 200,
      responseTime: 1,
    };
  });
}

/** Smallest gap between consecutive request starts. */
function minGap(times: number[]): number {
  const sorted = [...times].sort((a, b) => a - b);
  let smallest = Infinity;
  for (let i = 1; i < sorted.length; i++) {
    smallest = Math.min(smallest, sorted[i] - sorted[i - 1]);
  }
  return smallest;
}

// Real timers, real gaps. Kept small so the file stays quick.
const GAP = 40;
// Timer granularity and event-loop jitter mean the observed gap can land a few
// ms under the requested one; the bug being caught is ~0ms, not 38ms.
const TOLERANCE = 12;

describe('delay_ms puts a gap between requests', () => {
  it('spaces requests out when a delay is configured', async () => {
    const times: number[] = [];
    const crawler = new Crawler({
      maxPages: 4,
      concurrency: 1,
      respectRobots: false,
      delayMs: GAP,
      fetchPage: makeTimedFetcher(times),
    });

    await crawler.crawl('https://example.test/');

    expect(times.length).toBeGreaterThanOrEqual(3);
    expect(minGap(times)).toBeGreaterThanOrEqual(GAP - TOLERANCE);
  });

  it('does not delay when nothing asks it to', async () => {
    const times: number[] = [];
    const crawler = new Crawler({
      maxPages: 4,
      concurrency: 1,
      respectRobots: false,
      fetchPage: makeTimedFetcher(times),
    });

    const started = Date.now();
    await crawler.crawl('https://example.test/');

    // A Crawler built directly must keep its old speed: the config default of
    // 100ms belongs to the CLI, not to this constructor.
    expect(Date.now() - started).toBeLessThan(GAP * 3);
  });

  it('keeps the delay when the option is passed, rather than dropping it', async () => {
    // The constructor copies options field by field, so a new optional option
    // type-checks at every call site and is discarded on the way in. That is
    // exactly how this shipped: the plumbing was correct and the value was
    // thrown away here.
    const times: number[] = [];
    const crawler = new Crawler({
      maxPages: 3,
      concurrency: 1,
      respectRobots: false,
      perHostDelayMs: GAP,
      fetchPage: makeTimedFetcher(times),
    });

    await crawler.crawl('https://example.test/');

    expect(minGap(times)).toBeGreaterThanOrEqual(GAP - TOLERANCE);
  });
});

describe('the delay survives concurrency', () => {
  it('does not let parallel workers start together', async () => {
    // Three workers reading one "last request" timestamp all see the same
    // value and fire at once, turning a 40ms delay into no delay at all.
    const times: number[] = [];
    const crawler = new Crawler({
      maxPages: 6,
      concurrency: 3,
      respectRobots: false,
      delayMs: GAP,
      fetchPage: makeTimedFetcher(times),
    });

    await crawler.crawl('https://example.test/');

    expect(times.length).toBeGreaterThanOrEqual(4);
    expect(minGap(times)).toBeGreaterThanOrEqual(GAP - TOLERANCE);
  });

  it('applies the per-host gap to requests for the same host', async () => {
    const times: number[] = [];
    const crawler = new Crawler({
      maxPages: 5,
      concurrency: 3,
      respectRobots: false,
      perHostDelayMs: GAP,
      fetchPage: makeTimedFetcher(times),
    });

    await crawler.crawl('https://example.test/');

    expect(minGap(times)).toBeGreaterThanOrEqual(GAP - TOLERANCE);
  });
});
