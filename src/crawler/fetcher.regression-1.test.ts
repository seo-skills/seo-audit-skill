// Regression: ISSUE-002 — context.redirectChain was declared and read by
// redirect-loop and redirect-broken, but written by no code path, so both
// rules returned notMeasured on every page in every mode.
// Found by /qa on 2026-09-02
// Report: .gstack/qa-reports/qa-report-audit-cli-2026-09-02.md
import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchPage, createAuditContext } from './fetcher.js';

const PAGE = '<!DOCTYPE html><html lang="en"><head><title>Landed</title></head><body><h1>Landed</h1></body></html>';

/**
 * Serve a fixed redirect map: any URL present redirects to its value, anything
 * else returns the page. Mirrors the auditor test's stub style.
 */
function stubRedirects(map: Record<string, string>, finalStatus = 200) {
  const calls: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
      const url = typeof input === 'string' ? input : input.toString();
      calls.push(url);
      const location = map[url];
      if (location) {
        return new Response('', { status: 301, headers: { location } });
      }
      return new Response(PAGE, {
        status: finalStatus,
        headers: { 'content-type': 'text/html' },
      });
    })
  );
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

describe('fetchPage redirect tracking (ISSUE-002)', () => {
  it('records no chain at all unless the caller opts in', async () => {
    stubRedirects({});
    const result = await fetchPage('https://example.com/');
    // Absent, not empty: the rules read absence as "unmeasured".
    expect(result.redirectChain).toBeUndefined();
  });

  it('records a single hop for a page reached without any redirect', async () => {
    stubRedirects({});
    const result = await fetchPage('https://example.com/', 30000, { trackRedirects: true });
    expect(result.redirectChain).toEqual([{ url: 'https://example.com/', statusCode: 200 }]);
  });

  it('records every hop of a multi-step chain in order', async () => {
    stubRedirects({
      'https://example.com/a': 'https://example.com/b',
      'https://example.com/b': 'https://example.com/c',
    });
    const result = await fetchPage('https://example.com/a', 30000, { trackRedirects: true });
    expect(result.redirectChain?.map((h) => h.url)).toEqual([
      'https://example.com/a',
      'https://example.com/b',
      'https://example.com/c',
    ]);
    expect(result.statusCode).toBe(200);
  });

  it('resolves a relative Location against the current hop', async () => {
    stubRedirects({ 'https://example.com/old/page': '../new/page' });
    const result = await fetchPage('https://example.com/old/page', 30000, {
      trackRedirects: true,
    });
    expect(result.redirectChain?.map((h) => h.url)).toEqual([
      'https://example.com/old/page',
      'https://example.com/new/page',
    ]);
  });

  it('carries the final status when a chain ends on an error page', async () => {
    stubRedirects({ 'https://example.com/dead': 'https://example.com/gone' }, 404);
    const result = await fetchPage('https://example.com/dead', 30000, { trackRedirects: true });
    expect(result.statusCode).toBe(404);
    expect(result.redirectChain).toHaveLength(2);
  });

  it('names the cycle instead of returning an unauditable 3xx body', async () => {
    stubRedirects({
      'https://example.com/a': 'https://example.com/b',
      'https://example.com/b': 'https://example.com/a',
    });
    await expect(
      fetchPage('https://example.com/a', 30000, { trackRedirects: true })
    ).rejects.toThrow(/redirects in a loop/);
  });

  it('makes exactly one request per hop and no more', async () => {
    const calls = stubRedirects({ 'https://example.com/a': 'https://example.com/b' });
    await fetchPage('https://example.com/a', 30000, { trackRedirects: true });
    expect(calls).toEqual(['https://example.com/a', 'https://example.com/b']);
  });
});

describe('createAuditContext redirect passthrough (ISSUE-002)', () => {
  it('puts the chain on the context the redirect rules read', async () => {
    stubRedirects({ 'https://example.com/a': 'https://example.com/b' });
    const result = await fetchPage('https://example.com/a', 30000, { trackRedirects: true });
    const context = createAuditContext('https://example.com/a', result);
    expect(context.redirectChain).toHaveLength(2);
  });

  it('leaves the chain off the context when it was never tracked', async () => {
    stubRedirects({});
    const result = await fetchPage('https://example.com/');
    const context = createAuditContext('https://example.com/', result);
    expect(context.redirectChain).toBeUndefined();
  });
});
