/**
 * The run's URL service: each distinct request once, settled external
 * answers persisted, nothing else persisted, and a verdict that only calls a
 * link broken when its target is gone.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { UrlService, verdictFor } from './url-service.js';
import { LinkCache } from '../storage/link-cache.js';

type Answer = number | 'dns' | 'refused' | 'network' | { status: number; headers?: Record<string, string>; body?: string };

/** Stub fetch: per-URL (and optionally per-method) answers, every request recorded */
function stub(answers: Record<string, Answer | { HEAD?: Answer; GET?: Answer }> = {}, delayMs = 0) {
  const calls: Array<{ method: string; url: string; headers: Record<string, string>; redirect?: string }> = [];
  let inFlight = 0;
  const peak = { value: 0 };
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = init?.method ?? 'GET';
      calls.push({ method, url, headers: (init?.headers ?? {}) as Record<string, string>, ...(init?.redirect && { redirect: init.redirect }) });
      inFlight++;
      peak.value = Math.max(peak.value, inFlight);
      try {
        if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
        const entry = answers[url] ?? 200;
        const answer: Answer =
          typeof entry === 'object' && ('HEAD' in entry || 'GET' in entry)
            ? ((entry as { HEAD?: Answer; GET?: Answer })[method as 'HEAD' | 'GET'] ?? 200)
            : (entry as Answer);
        if (answer === 'dns' || answer === 'refused' || answer === 'network') {
          const code = answer === 'dns' ? 'ENOTFOUND' : answer === 'refused' ? 'ECONNREFUSED' : 'ECONNRESET';
          throw Object.assign(new TypeError('fetch failed'), { cause: { code } });
        }
        const { status, headers, body } = typeof answer === 'number' ? { status: answer, headers: {}, body: 'body' } : { body: 'body', ...answer };
        return new Response(method === 'HEAD' || status === 204 ? null : body, { status, headers });
      } finally {
        inFlight--;
      }
    })
  );
  return { calls, peak };
}

const dirs: string[] = [];
function tempCache(): LinkCache {
  const dir = mkdtempSync(join(tmpdir(), 'seomator-links-'));
  dirs.push(dir);
  return new LinkCache({ dbPath: join(dir, 'link-cache.db'), ttlDays: 7 });
}

afterEach(() => {
  vi.unstubAllGlobals();
  while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true });
});

const SITE = 'https://site.test/';
const EXT = 'https://other.test/page';

describe('verdicts', () => {
  it('calls a target broken only when it is gone', () => {
    expect(verdictFor(200)).toBe('ok');
    expect(verdictFor(301)).toBe('ok');
    expect(verdictFor(404)).toBe('broken');
    expect(verdictFor(410)).toBe('broken');
    expect(verdictFor(500)).toBe('broken');
    expect(verdictFor(0, 'dns')).toBe('broken');
  });

  it('calls a refusal or silence "could not verify", never broken', () => {
    for (const status of [401, 403, 429, 503, 999]) expect(verdictFor(status)).toBe('blocked');
    expect(verdictFor(0, 'timeout')).toBe('unknown');
    expect(verdictFor(0, 'network')).toBe('unknown');
  });
});

describe('one request per distinct question', () => {
  it('sends one HEAD for many concurrent askers of the same URL', async () => {
    const { calls } = stub({}, 20);
    const service = new UrlService({ siteUrl: SITE });
    const answers = await Promise.all(Array.from({ length: 10 }, () => service.status(EXT)));
    expect(answers.every((a) => a.verdict === 'ok')).toBe(true);
    expect(calls).toEqual([expect.objectContaining({ method: 'HEAD', url: EXT })]);
    await service.status(EXT);
    expect(calls).toHaveLength(1);
  });

  it('keeps requests with different headers, redirects or ranges apart', async () => {
    const { calls } = stub();
    const service = new UrlService({ siteUrl: SITE });
    await service.status(EXT);
    await service.get(EXT, { method: 'GET', headers: { Accept: 'text/markdown' } });
    await service.get(EXT, { method: 'GET', followRedirects: false });
    await service.get(EXT, { needBytes: 512 });
    expect(calls).toHaveLength(4);
  });

  it('confirms a failed HEAD with GET, and trusts GET', async () => {
    const { calls } = stub({ [EXT]: { HEAD: 405, GET: 200 } });
    const info = await new UrlService({ siteUrl: SITE }).status(EXT);
    expect(info.status).toBe(200);
    expect(calls.map((c) => c.method)).toEqual(['HEAD', 'GET']);
  });
});

describe('request shapes', () => {
  it('returns the first response and its location when told not to follow', async () => {
    const { calls } = stub({ [EXT]: { status: 301, headers: { location: '/moved' } } });
    const info = await new UrlService({ siteUrl: SITE }).get(EXT, { method: 'GET', followRedirects: false });
    expect(info.status).toBe(301);
    expect(info.location).toBe('https://other.test/moved');
    expect(calls[0].redirect).toBe('manual');
  });

  it('asks for a byte range and reads the full size from Content-Range', async () => {
    const { calls } = stub({ [EXT]: { status: 206, headers: { 'content-range': 'bytes 0-3/123456' }, body: 'abcd' } });
    const info = await new UrlService({ siteUrl: SITE }).get(EXT, { needBytes: 4 });
    expect(calls[0].headers['Range']).toBe('bytes=0-3');
    expect(new TextDecoder().decode(info.bytes)).toBe('abcd');
    expect(info.contentLength).toBe(123456);
  });
});

describe('limits and rate limits', () => {
  it('never has more requests to one host in flight than the per-host limit', async () => {
    const { peak } = stub({}, 30);
    const service = new UrlService({ siteUrl: SITE, concurrency: 10, perHostConcurrency: 2 });
    await Promise.all(Array.from({ length: 8 }, (_, i) => service.status(`https://other.test/${i}`)));
    expect(peak.value).toBe(2);
  });

  it('waits out a 429 and reports one that never clears as rate-limited, not broken', async () => {
    const { calls } = stub({ [EXT]: { status: 429, headers: { 'retry-after': '0' } } });
    const info = await new UrlService({ siteUrl: SITE }).status(EXT);
    expect(info).toMatchObject({ status: 429, rateLimited: true, verdict: 'blocked' });
    // HEAD fails, GET confirms: two requests per attempt, four attempts
    expect(calls).toHaveLength(8);
  });

  it('tells a domain that does not resolve from one that did not answer', async () => {
    stub({ 'https://gone.test/': 'dns', 'https://flaky.test/': 'network' });
    const service = new UrlService({ siteUrl: SITE });
    expect((await service.status('https://gone.test/')).verdict).toBe('broken');
    expect((await service.status('https://flaky.test/')).verdict).toBe('unknown');
  });
});

describe('the persisted link cache', () => {
  it('answers a settled external status from the cache on the next run', async () => {
    const cache = tempCache();
    const { calls } = stub({ 'https://other.test/gone': 404 });
    await new UrlService({ siteUrl: SITE, cache }).status(EXT);
    await new UrlService({ siteUrl: SITE, cache }).status('https://other.test/gone');
    const before = calls.length;

    const next = new UrlService({ siteUrl: SITE, cache });
    expect(await next.status(EXT)).toMatchObject({ verdict: 'ok', cached: true });
    expect(await next.status('https://other.test/gone')).toMatchObject({ verdict: 'broken', status: 404, cached: true });
    expect(calls.length).toBe(before);
  });

  it('does not persist an outage, a refusal, an internal URL or a shaped request', async () => {
    const cache = tempCache();
    stub({ 'https://down.test/': 502, 'https://nxdomain.test/': 'dns', 'https://walled.test/': 403 });
    const service = new UrlService({ siteUrl: SITE, cache });
    await service.status('https://down.test/');
    await service.status('https://nxdomain.test/');
    await service.status('https://walled.test/');
    await service.status('https://site.test/internal');
    await service.get(EXT, { method: 'GET', headers: { Accept: 'text/markdown' } });
    for (const url of ['https://down.test/', 'https://nxdomain.test/', 'https://walled.test/', 'https://site.test/internal', EXT]) {
      expect(cache.get(url), url).toBeNull();
    }
  });

  it('asks again under refresh, and stores the fresh answer', async () => {
    const cache = tempCache();
    const { calls } = stub();
    await new UrlService({ siteUrl: SITE, cache }).status(EXT);
    await new UrlService({ siteUrl: SITE, cache, refresh: true }).status(EXT);
    expect(calls).toHaveLength(2);
  });
});
