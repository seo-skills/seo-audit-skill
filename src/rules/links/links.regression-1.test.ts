// Regression: ISSUE-005 — unanswered link checks were reported as broken links
// Found by /qa on 2026-10-15
// Report: .gstack/qa-reports/run-20261015T075717Z/qa-report-developer-mozilla-org-2026-10-15.md
//
// links-broken-internal failed developer.mozilla.org on 6 "broken" links, and
// every page of a 6-page crawl on 46 more. Every one was status 0, a timeout or
// network error, and each URL answered 200 when asked again (some had already
// answered 200 earlier in the same run). The rule also requested 448 links
// one at a time when they named 356 distinct URLs, 18 of them the audited page
// itself. Separately, fetchUrl trusted HEAD alone: bsky.app answers HEAD with
// 404 and GET with the profile page, so links-external-valid reported a live
// link as unreachable.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createTestContext } from '../test-context.js';
import { brokenInternalRule } from './broken-internal.js';
import { redirectChainsRule } from './redirect-chains.js';
import { fetchUrl } from '../../crawler/fetcher.js';
import type { LinkInfo } from '../../types.js';

const PAGE = 'https://example.com/docs/page';

type Answer = number | 'network-error';

/** Stub fetch with a per-method answer for each URL; records every request. */
function stubServer(answers: Record<string, { HEAD?: Answer; GET?: Answer }>) {
  const calls: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = init?.method ?? 'GET';
      calls.push(`${method} ${url}`);
      const answer = answers[url]?.[method as 'HEAD' | 'GET'] ?? 200;
      if (answer === 'network-error') throw new TypeError('fetch failed');
      return new Response(method === 'HEAD' ? null : 'body', { status: answer });
    })
  );
  return calls;
}

function link(href: string): LinkInfo {
  return { href, text: 'x', isInternal: true, isNoFollow: false } as LinkInfo;
}

afterEach(() => vi.unstubAllGlobals());

describe('fetchUrl confirms a failed HEAD with GET (ISSUE-005)', () => {
  it('reports the GET status when the server rejects HEAD', async () => {
    stubServer({ 'https://bsky.app/profile/x': { HEAD: 404, GET: 200 } });
    expect(await fetchUrl('https://bsky.app/profile/x')).toBe(200);
  });

  it('retries a HEAD that got no answer', async () => {
    stubServer({ [`${PAGE}/a`]: { HEAD: 'network-error', GET: 200 } });
    expect(await fetchUrl(`${PAGE}/a`)).toBe(200);
  });

  it('still reports a page that is really gone, and makes one request when HEAD succeeds', async () => {
    const calls = stubServer({ [`${PAGE}/gone`]: { HEAD: 404, GET: 404 } });
    expect(await fetchUrl(`${PAGE}/gone`)).toBe(404);
    expect(await fetchUrl(`${PAGE}/ok`)).toBe(200);
    expect(calls.filter((call) => call.endsWith('/ok'))).toEqual([`HEAD ${PAGE}/ok`]);
  });
});

describe('links-broken-internal (ISSUE-005)', () => {
  it('does not call a link broken because the check got no answer', async () => {
    stubServer({ [`${PAGE}/slow`]: { HEAD: 'network-error', GET: 'network-error' } });
    const context = createTestContext('<html></html>', { url: PAGE, links: [link(`${PAGE}/slow`)] });
    const result = await brokenInternalRule.run(context);
    expect(result.status).not.toBe('fail');
    expect(result.message).toMatch(/could not be checked/);
  });

  it('fails on a real 404', async () => {
    stubServer({ [`${PAGE}/gone`]: { HEAD: 404, GET: 404 } });
    const context = createTestContext('<html></html>', { url: PAGE, links: [link(`${PAGE}/gone`)] });
    expect((await brokenInternalRule.run(context)).status).toBe('fail');
  });

  it('checks each distinct URL once and skips links to the page itself', async () => {
    const calls = stubServer({});
    const links = [
      link(`${PAGE}#content`),
      link(PAGE),
      link(`${PAGE}/a`),
      link(`${PAGE}/a#section`),
      link(`${PAGE}/a`),
      link(`${PAGE}/b`),
    ];
    const result = await brokenInternalRule.run(createTestContext('<html></html>', { url: PAGE, links }));
    expect(result.status).toBe('pass');
    expect(calls).toEqual([`HEAD ${PAGE}/a`, `HEAD ${PAGE}/b`]);
    expect(result.details?.totalChecked).toBe(2);
  });
});

// Regression: ISSUE-024 — links-redirect-chains spent its sample on links to the page itself
// Found by /qa on 2026-10-15
// Report: .gstack/qa-reports/run-20261015T075717Z/qa-report-developer-mozilla-org-2026-10-15.md
//
// The rule checks 20 internal links. On developer.mozilla.org 3 of those 20
// were the audited page (#content, #mdn-search, the bare URL), and /a and
// /a#b counted as two. The page's real redirects (/ -> /en-US/, /discord)
// were outside the sample.
describe('links-redirect-chains sample (ISSUE-024)', () => {
  it('samples distinct other pages, fragments stripped', async () => {
    const calls = stubServer({});
    const links = [link(`${PAGE}#content`), link(PAGE), link(`${PAGE}/a`), link(`${PAGE}/a#b`), link(`${PAGE}/c`)];
    const result = await redirectChainsRule.run(createTestContext('<html></html>', { url: PAGE, links }));
    expect(result.details?.totalChecked).toBe(2);
    expect(new Set(calls.map((call) => call.split(' ')[1]))).toEqual(new Set([`${PAGE}/a`, `${PAGE}/c`]));
  });
});
