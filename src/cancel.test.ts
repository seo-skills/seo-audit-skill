/**
 * Cancellation, end to end.
 *
 * The point of these tests is that an aborted run actually stops: no request
 * outlives the abort, no page is scored afterwards, and the failure is an
 * AuditAbortedError rather than 332 rules reporting "execution failed".
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Auditor } from './auditor.js';
import { Crawler } from './crawler/crawler.js';
import { fetchPage, fetchUrl, fetchUrlWithRedirects, requestSignal } from './crawler/fetcher.js';
import { fetchSitemap } from './crawler/sitemap.js';
import { AuditAbortedError, AuditError, classifyError, isAbortError } from './errors.js';
import type { FetchResult } from './crawler/fetcher.js';

const HTML = `<!doctype html><html lang="en"><head><title>Cancel fixture page</title>
<meta name="description" content="A page used by the cancellation tests."></head>
<body><h1>Cancel</h1><a href="/a">a</a><a href="/b">b</a><a href="/c">c</a></body></html>`;

/**
 * A fetcher that never settles until it is aborted, tracking how many
 * requests are in flight. No timers, no network: the count is the assertion.
 */
function makeHangingFetcher() {
  const state = { started: 0, inFlight: 0, aborted: 0 };
  const fetcher = (_url: string, _timeout: number, options?: { signal?: AbortSignal }): Promise<FetchResult> => {
    state.started++;
    state.inFlight++;
    return new Promise<FetchResult>((_resolve, reject) => {
      const onAbort = (): void => {
        state.inFlight--;
        state.aborted++;
        reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
      };
      if (options?.signal?.aborted) return onAbort();
      options?.signal?.addEventListener('abort', onAbort, { once: true });
    });
  };
  return { state, fetcher };
}

describe('error classification', () => {
  it('recognises abort errors from every source', () => {
    expect(isAbortError(Object.assign(new Error('x'), { name: 'AbortError' }))).toBe(true);
    expect(isAbortError(Object.assign(new Error('x'), { code: 'ABORT_ERR' }))).toBe(true);
    expect(isAbortError(new AuditAbortedError())).toBe(true);
    expect(isAbortError(new Error('plain'))).toBe(false);
  });

  it('maps common engine failures onto actionable codes', () => {
    const dns = classifyError(Object.assign(new Error('fetch failed'), { cause: { code: 'ENOTFOUND' } }));
    expect(dns.code).toBe('dns');
    expect(dns.hint).toContain('hostname');

    expect(classifyError(new Error('The operation timed out')).code).toBe('timeout');
    expect(
      classifyError(new Error("browserType.launch: Executable doesn't exist at /chromium")).code
    ).toBe('playwright-missing');
    expect(classifyError(new Error('something else')).code).toBe('unknown');
    // An already-typed error passes through untouched
    const typed = new AuditError('no-pages', 'nothing to audit');
    expect(classifyError(typed)).toBe(typed);
  });
});

describe('requestSignal', () => {
  it('fires when the caller aborts and reports it as not a timeout', () => {
    const controller = new AbortController();
    const request = requestSignal(60_000, controller.signal);
    controller.abort();
    expect(request.signal.aborted).toBe(true);
    expect(request.timedOut()).toBe(false);
    request.dispose();
  });

  it('fires on the timeout and says so', async () => {
    const request = requestSignal(1);
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(request.signal.aborted).toBe(true);
    expect(request.timedOut()).toBe(true);
    request.dispose();
  });
});

describe('fetch helpers honour the signal', () => {
  it('fetchPage rejects immediately when the signal is already aborted', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    try {
      await expect(fetchPage('https://x.test/', 30_000, { signal: AbortSignal.abort() })).rejects.toBeInstanceOf(
        AuditAbortedError
      );
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('fetchPage reports a timeout as a timeout, not a cancellation', async () => {
    vi.stubGlobal('fetch', (_url: string, init: RequestInit) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () =>
          reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))
        );
      })
    );
    try {
      const error = await fetchPage('https://slow.test/', 5).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(AuditError);
      expect((error as AuditError).code).toBe('timeout');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('fetchUrl reports its own timeout as 0, not as a cancellation', async () => {
    vi.stubGlobal('fetch', (_url: string, init: RequestInit) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () =>
          reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))
        );
      })
    );
    try {
      // No run signal: the abort can only be the timeout, which is a 0.
      await expect(fetchUrl('https://slow.test/', 5)).resolves.toBe(0);
      // With a run signal that has not fired, a timeout is still a 0.
      await expect(fetchUrl('https://slow.test/', 5, new AbortController().signal)).resolves.toBe(0);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('fetchUrl turns network failures into 0 but lets a cancellation through', async () => {
    vi.stubGlobal('fetch', () => Promise.reject(new Error('ECONNREFUSED')));
    try {
      await expect(fetchUrl('https://x.test/')).resolves.toBe(0);
    } finally {
      vi.unstubAllGlobals();
    }
    await expect(fetchUrl('https://x.test/', 10_000, AbortSignal.abort())).rejects.toBeInstanceOf(AuditAbortedError);
  });

  it('fetchUrlWithRedirects stops on a cancelled signal', async () => {
    await expect(
      fetchUrlWithRedirects('https://x.test/', 10_000, 5, AbortSignal.abort())
    ).rejects.toBeInstanceOf(AuditAbortedError);
  });

  it('fetchSitemap stops instead of returning an empty sitemap', async () => {
    await expect(fetchSitemap('https://x.test/', undefined, AbortSignal.abort())).rejects.toBeInstanceOf(
      AuditAbortedError
    );
  });
});

describe('Crawler cancellation', () => {
  it('aborts in-flight fetches and starts no new ones', async () => {
    const { state, fetcher } = makeHangingFetcher();
    const controller = new AbortController();
    const crawler = new Crawler({
      maxPages: 20,
      concurrency: 3,
      timeout: 30_000,
      respectRobots: false,
      signal: controller.signal,
      fetchPage: fetcher,
    });

    const run = crawler.crawl('https://hang.test/');
    // Let the three workers pick up their first URLs
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(state.inFlight).toBeGreaterThan(0);

    controller.abort();
    await expect(run).rejects.toBeInstanceOf(AuditAbortedError);

    const startedAtAbort = state.started;
    expect(state.inFlight).toBe(0);
    expect(state.aborted).toBeGreaterThan(0);

    // Nothing keeps running in the background after the rejection
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(state.started).toBe(startedAtAbort);
  });

  it('reports monotonic progress and a final done callback', async () => {
    const progress: Array<{ crawled: number; total: number; done: boolean; maxPages: number }> = [];
    const started: string[] = [];
    const crawler = new Crawler({
      maxPages: 3,
      concurrency: 1,
      timeout: 30_000,
      respectRobots: false,
      onProgress: (p) => progress.push({ crawled: p.crawled, total: p.total, done: p.done, maxPages: p.maxPages }),
      onPageStart: (url) => started.push(url),
      fetchPage: async (url) => ({
        html: HTML,
        $: (await import('cheerio')).load(HTML),
        headers: { 'content-type': 'text/html' },
        statusCode: 200,
        responseTime: 1,
        cookies: [],
      }),
    });

    const pages = await crawler.crawl('https://progress.test/');
    expect(pages).toHaveLength(3);
    expect(started).toHaveLength(3);

    expect(progress.length).toBeGreaterThan(1);
    for (let i = 1; i < progress.length; i++) {
      expect(progress[i]!.crawled).toBeGreaterThanOrEqual(progress[i - 1]!.crawled);
      expect(progress[i]!.total).toBeGreaterThanOrEqual(progress[i]!.crawled);
      // Never advertise more work than the crawl will do
      expect(progress[i]!.total).toBeLessThanOrEqual(3);
      expect(progress[i]!.maxPages).toBe(3);
    }
    const last = progress[progress.length - 1]!;
    expect(last.done).toBe(true);
    expect(last.crawled).toBe(3);
    expect(progress.slice(0, -1).every((p) => !p.done)).toBe(true);
  });
});

describe('Auditor cancellation', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.endsWith('/robots.txt') || url.endsWith('/sitemap.xml')) {
          return new Response('', { status: 404 });
        }
        return new Response(HTML, { status: 200, headers: { 'content-type': 'text/html' } });
      })
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('audit() refuses to start once cancelled', async () => {
    const auditor = new Auditor({ measureCwv: false, signal: AbortSignal.abort() });
    await expect(auditor.audit('https://x.test/')).rejects.toBeInstanceOf(AuditAbortedError);
  });

  it('auditWithCrawl() stops mid-crawl instead of scoring the pages it has', async () => {
    const { state, fetcher } = makeHangingFetcher();
    const controller = new AbortController();
    const auditor = new Auditor({
      measureCwv: false,
      signal: controller.signal,
      categories: ['core'],
    });

    // The crawler's own fetcher is the one that hangs; the auditor's robots
    // and sitemap fetches go through the stubbed global fetch above.
    const crawlerModule = await import('./crawler/crawler.js');
    const original = crawlerModule.Crawler.prototype.crawl;
    const spy = vi
      .spyOn(crawlerModule.Crawler.prototype, 'crawl')
      .mockImplementation(function (this: InstanceType<typeof crawlerModule.Crawler>, ...args) {
        // Swap in the hanging fetcher without changing anything else
        (this as unknown as { options: { fetchPage: typeof fetcher } }).options.fetchPage = fetcher;
        return original.apply(this, args);
      });

    try {
      const run = auditor.auditWithCrawl('https://hang.test/', 10, 2);
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(state.inFlight).toBeGreaterThan(0);
      controller.abort();
      await expect(run).rejects.toBeInstanceOf(AuditAbortedError);
      expect(state.inFlight).toBe(0);
    } finally {
      spy.mockRestore();
    }
  });

  it('a rule that is cancelled mid-request aborts the run rather than failing the rule', async () => {
    const controller = new AbortController();
    const auditor = new Auditor({ measureCwv: false, signal: controller.signal });
    const context = {
      url: 'https://rule.test/',
      html: HTML,
      $: (await import('cheerio')).load(HTML),
      headers: {},
      statusCode: 200,
      responseTime: 1,
      cwv: {},
      links: [],
      images: [],
      invalidLinks: [],
      specialLinks: [],
      figures: [],
      inlineSvgs: [],
      pictureElements: [],
      signal: controller.signal,
    };
    controller.abort();
    await expect(auditor.runAllCategories(context)).rejects.toBeInstanceOf(AuditAbortedError);
  });
});
