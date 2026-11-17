/**
 * A crawl asks each site-wide question once. robots.txt, the made-up URL that
 * tests the 404 page, the GEO well-known files and a PDF every page links to
 * used to be requested by every page's rules: twenty pages, twenty times each.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Auditor } from '../auditor.js';

const ORIGIN = 'https://site.test';
const PAGES = 20;

function html(path: string): string {
  const nav = path === '/' ? Array.from({ length: PAGES - 1 }, (_, i) => `<a href="/p${i + 1}">Page ${i + 1}</a>`).join(' ') : '<a href="/">Home</a>';
  return `<!doctype html><html lang="en"><head><title>Page ${path} of the test site</title>
<link rel="canonical" href="${ORIGIN}${path}"></head>
<body><main><h1>Page ${path}</h1>${nav} <a href="/files/guide.pdf">Guide</a></main></body></html>`;
}

function serve() {
  const requests: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const method = init?.method ?? 'GET';
      const path = new URL(url).pathname;
      requests.push(`${method} ${path}`);
      if (path === '/' || /^\/p\d+$/.test(path)) {
        return new Response(method === 'HEAD' ? null : html(path), { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } });
      }
      if (path === '/robots.txt') return new Response('User-agent: *\nAllow: /\n', { status: 200, headers: { 'content-type': 'text/plain' } });
      if (path === '/files/guide.pdf') return new Response(null, { status: 200, headers: { 'content-type': 'application/pdf', 'content-length': '2048' } });
      return new Response('Not found', { status: 404, headers: { 'content-type': 'text/html' } });
    })
  );
  return requests;
}

const dirs: string[] = [];
beforeEach(() => {
  const dir = mkdtempSync(join(tmpdir(), 'seomator-run-'));
  dirs.push(dir);
  process.env['SEOMATOR_HOME'] = dir;
});
afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env['SEOMATOR_HOME'];
  while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true });
});

describe('site-wide questions are asked once per run', () => {
  it('requests each probe once across a 20-page crawl, not once per page', async () => {
    const requests = serve();
    const result = await new Auditor({ measureCwv: false }).auditWithCrawl(`${ORIGIN}/`, PAGES, 4);
    expect(result.crawledPages).toBe(PAGES);

    const count = (pattern: RegExp) => requests.filter((r) => pattern.test(r)).length;
    // The 404 test URL: one per run, where every page used to make its own
    expect(count(/seo-audit-test-nonexistent-page/)).toBe(1);
    // The PDF every page links to: one status check (shared by the size and
    // broken-link rules) and one redirect hop
    expect(count(/^HEAD \/files\/guide\.pdf$/)).toBe(2);
    // GEO probes: one request per file
    for (const file of ['/AGENTS.md', '/.well-known/agent.json', '/.well-known/mcp.json', '/index.md']) {
      expect(count(new RegExp(`^GET ${file.replace(/\./g, '\\.')}$`)), file).toBe(1);
    }
    // robots.txt and the sitemap: the crawler and the audit read them, and
    // every page's rules share one more answer
    expect(count(/^GET \/robots\.txt$/)).toBeLessThanOrEqual(3);
    expect(count(/^GET \/sitemap\.xml$/)).toBeLessThanOrEqual(3);
  });
});
