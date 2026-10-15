// Regression: ISSUE-009 — sitemap limits were checked on the index file, never on the sitemaps it lists
// Found by /qa on 2026-10-15
// Report: .gstack/qa-reports/run-20261015T075717Z/qa-report-developer-mozilla-org-2026-10-15.md
//
// developer.mozilla.org/sitemap.xml is an index of 10 gzipped sitemaps (the
// largest lists 14,839 URLs and is 1.94 MB uncompressed). The context held only
// the root document, so crawl-sitemap-url-limit passed with "Sitemap contains 0
// URLs" and crawl-sitemap-size-limit measured the 1.3 KB index. A child listing
// 60,000 URLs would have passed both. The protocol's limits are per file.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createTestContext } from '../test-context.js';
import { fetchSitemap } from '../../crawler/sitemap.js';
import { sitemapUrlLimitRule } from './sitemap-url-limit.js';
import { sitemapSizeLimitRule } from './sitemap-size-limit.js';

const ORIGIN = 'https://example.com';

function urlset(count: number): string {
  const urls = Array.from({ length: count }, (_, i) => `<url><loc>${ORIGIN}/p/${i}</loc></url>`).join('');
  return `<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`;
}

const INDEX = `<?xml version="1.0"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>${ORIGIN}/small.xml</loc></sitemap>
  <sitemap><loc>${ORIGIN}/huge.xml</loc></sitemap>
</sitemapindex>`;

function stubSite(files: Record<string, string | null>) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
      const body = files[typeof input === 'string' ? input : input.toString()];
      return body == null ? new Response('', { status: 404 }) : new Response(body, { status: 200 });
    })
  );
}

async function contextFor(files: Record<string, string | null>) {
  stubSite(files);
  const sitemap = await fetchSitemap(`${ORIGIN}/`);
  return createTestContext('<html></html>', {
    url: `${ORIGIN}/`,
    sitemapContent: sitemap.content,
    sitemapUrls: sitemap.urls,
    sitemapIsIndex: sitemap.isIndex,
    sitemapDocuments: sitemap.documents,
  });
}

afterEach(() => vi.unstubAllGlobals());

describe('sitemap limits are checked per sitemap file (ISSUE-009)', () => {
  it('records the size of every sitemap document fetched', async () => {
    stubSite({ [`${ORIGIN}/sitemap.xml`]: INDEX, [`${ORIGIN}/small.xml`]: urlset(3), [`${ORIGIN}/huge.xml`]: urlset(5) });
    const sitemap = await fetchSitemap(`${ORIGIN}/`);
    expect(sitemap.documents.map((doc) => [doc.url, doc.urlCount, doc.isIndex])).toEqual([
      [`${ORIGIN}/sitemap.xml`, 0, true],
      [`${ORIGIN}/small.xml`, 3, false],
      [`${ORIGIN}/huge.xml`, 5, false],
    ]);
    expect(sitemap.documents[1].bytes).toBe(Buffer.byteLength(urlset(3)));
  });

  it('crawl-sitemap-url-limit fails a child sitemap over 50,000 URLs behind an index', async () => {
    const context = await contextFor({
      [`${ORIGIN}/sitemap.xml`]: INDEX,
      [`${ORIGIN}/small.xml`]: urlset(3),
      [`${ORIGIN}/huge.xml`]: urlset(50_001),
    });
    const result = await sitemapUrlLimitRule.run(context);
    expect(result.status).toBe('fail');
    expect(result.message).toMatch(/huge\.xml/);
  }, 20_000);

  it('crawl-sitemap-url-limit reports the largest child, not "0 URLs", when all are within the limit', async () => {
    const context = await contextFor({
      [`${ORIGIN}/sitemap.xml`]: INDEX,
      [`${ORIGIN}/small.xml`]: urlset(3),
      [`${ORIGIN}/huge.xml`]: urlset(7),
    });
    const result = await sitemapUrlLimitRule.run(context);
    expect(result.status).toBe('pass');
    expect(result.message).not.toMatch(/contains 0 URLs/);
    expect(result.details?.largestUrlCount).toBe(7);
  });

  it('both rules are not measured when the index lists no sitemap that could be fetched', async () => {
    const context = await contextFor({ [`${ORIGIN}/sitemap.xml`]: INDEX });
    expect((await sitemapUrlLimitRule.run(context)).status).toBe('not-measured');
    expect((await sitemapSizeLimitRule.run(context)).status).toBe('not-measured');
  });

  it('crawl-sitemap-size-limit measures the child sitemaps, not the index', async () => {
    const context = await contextFor({
      [`${ORIGIN}/sitemap.xml`]: INDEX,
      [`${ORIGIN}/small.xml`]: urlset(3),
      [`${ORIGIN}/huge.xml`]: urlset(40),
    });
    const result = await sitemapSizeLimitRule.run(context);
    expect(result.status).toBe('pass');
    expect(result.details?.sizeBytes).toBe(Buffer.byteLength(urlset(40)));
  });
});
