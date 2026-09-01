import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  parseSitemapEntries,
  parseSitemapIndex,
  parseSitemapDeclarations,
  isSitemapIndex,
  fetchSitemap,
} from './sitemap.js';

const URLSET = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://example.com/</loc>
    <lastmod>2026-08-01</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://example.com/about?a=1&amp;b=2</loc>
    <lastmod>2026-08-02T10:00:00+00:00</lastmod>
  </url>
</urlset>`;

const INDEX = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>https://example.com/sitemap-posts.xml</loc></sitemap>
  <sitemap><loc>https://example.com/sitemap-pages.xml.gz</loc></sitemap>
</sitemapindex>`;

describe('isSitemapIndex', () => {
  it('distinguishes an index from a urlset', () => {
    expect(isSitemapIndex(INDEX)).toBe(true);
    expect(isSitemapIndex(URLSET)).toBe(false);
  });

  it('is not fooled by a URL containing the word sitemap', () => {
    // The old code searched for <loc> anywhere and could not tell these apart.
    const tricky = `<urlset><url><loc>https://example.com/sitemap-guide/</loc></url></urlset>`;
    expect(isSitemapIndex(tricky)).toBe(false);
  });
});

describe('parseSitemapEntries', () => {
  it('reads loc, lastmod, changefreq and priority', () => {
    const entries = parseSitemapEntries(URLSET);
    expect(entries).toHaveLength(2);
    expect(entries[0]).toEqual({
      loc: 'https://example.com/',
      lastmod: '2026-08-01',
      changefreq: 'daily',
      priority: 1,
    });
    expect(entries[1].lastmod).toBe('2026-08-02T10:00:00+00:00');
  });

  it('decodes XML entities in URLs', () => {
    expect(parseSitemapEntries(URLSET)[1].loc).toBe('https://example.com/about?a=1&b=2');
  });

  it('unwraps CDATA', () => {
    const xml = `<urlset><url><loc><![CDATA[https://example.com/x]]></loc></url></urlset>`;
    expect(parseSitemapEntries(xml)[0].loc).toBe('https://example.com/x');
  });

  it('falls back to bare loc extraction for a malformed urlset', () => {
    const xml = `<urlset><loc>https://example.com/a</loc><loc>https://example.com/b</loc></urlset>`;
    expect(parseSitemapEntries(xml).map((e) => e.loc)).toEqual([
      'https://example.com/a',
      'https://example.com/b',
    ]);
  });
});

describe('parseSitemapIndex', () => {
  it('returns the child sitemap URLs', () => {
    expect(parseSitemapIndex(INDEX)).toEqual([
      'https://example.com/sitemap-posts.xml',
      'https://example.com/sitemap-pages.xml.gz',
    ]);
  });
});

describe('parseSitemapDeclarations', () => {
  it('returns every Sitemap line, not just the first', () => {
    // Regression: a non-global match kept only the first declaration, so a
    // site splitting its sitemaps by section had all but one ignored.
    const robots = [
      'User-agent: *',
      'Disallow: /admin',
      'Sitemap: https://example.com/sitemap-posts.xml',
      'Sitemap: https://example.com/sitemap-pages.xml',
      'sitemap: https://example.com/sitemap-news.xml',
    ].join('\n');

    expect(parseSitemapDeclarations(robots)).toEqual([
      'https://example.com/sitemap-posts.xml',
      'https://example.com/sitemap-pages.xml',
      'https://example.com/sitemap-news.xml',
    ]);
  });

  it('returns nothing when robots.txt declares no sitemap', () => {
    expect(parseSitemapDeclarations('User-agent: *\nDisallow:')).toEqual([]);
  });
});

/**
 * fetchSitemap records which sitemap document listed each URL, so the
 * "URL in multiple XML sitemaps" hint can be checked without re-fetching.
 */
describe('fetchSitemap urlSources', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /** Serve the given URL → XML body map; anything else 404s. */
  function stubSitemapFetch(documents: Record<string, string>): void {
    vi.stubGlobal('fetch', vi.fn(async (url: string | URL | Request) => {
      const body = documents[String(url)];
      if (body === undefined) {
        return new Response('not found', { status: 404 });
      }
      return new Response(body, { status: 200 });
    }));
  }

  it('maps each URL to the sitemap document that listed it', async () => {
    stubSitemapFetch({ 'https://example.com/sitemap.xml': URLSET });

    const result = await fetchSitemap('https://example.com/');

    expect(result.urlSources!.get('https://example.com/')).toEqual([
      'https://example.com/sitemap.xml',
    ]);
  });

  it('records a URL listed by several sitemap documents under each of them', async () => {
    const posts = `<urlset><url><loc>https://example.com/shared</loc></url></urlset>`;
    const pages = `<urlset><url><loc>https://example.com/shared</loc></url></urlset>`;
    stubSitemapFetch({
      'https://example.com/sitemap.xml': INDEX,
      'https://example.com/sitemap-posts.xml': posts,
      'https://example.com/sitemap-pages.xml.gz': pages,
    });

    const result = await fetchSitemap('https://example.com/');

    expect(result.urlSources!.get('https://example.com/shared')).toEqual([
      'https://example.com/sitemap-posts.xml',
      'https://example.com/sitemap-pages.xml.gz',
    ]);
  });

  it('follows robots.txt declarations, each contributing its own source', async () => {
    stubSitemapFetch({
      'https://example.com/sm-a.xml': `<urlset><url><loc>https://example.com/a</loc></url></urlset>`,
      'https://example.com/sm-b.xml': `<urlset><url><loc>https://example.com/b</loc></url></urlset>`,
    });
    const robots = 'Sitemap: https://example.com/sm-a.xml\nSitemap: https://example.com/sm-b.xml';

    const result = await fetchSitemap('https://example.com/', robots);

    expect(result.urlSources!.get('https://example.com/a')).toEqual(['https://example.com/sm-a.xml']);
    expect(result.urlSources!.get('https://example.com/b')).toEqual(['https://example.com/sm-b.xml']);
  });

  it('omits urlSources when no sitemap could be fetched', async () => {
    stubSitemapFetch({});

    const result = await fetchSitemap('https://example.com/');

    expect(result.urlSources).toBeUndefined();
  });
});
