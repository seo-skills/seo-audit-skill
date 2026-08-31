import { describe, it, expect } from 'vitest';
import {
  parseSitemapEntries,
  parseSitemapIndex,
  parseSitemapDeclarations,
  isSitemapIndex,
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
