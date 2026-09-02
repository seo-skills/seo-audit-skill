// Regression: ISSUE-001 — size-based perf rules returned pass() for assets
// whose content-length was absent, asserting "compressed" / "minified" /
// "reasonably sized" about files they never read. Chunked transfer-encoding
// and HTTP/2 framing omit the header on most real sites.
// Found by /qa on 2026-09-02
// Report: .gstack/qa-reports/qa-report-audit-cli-2026-09-02.md
import { describe, it, expect } from 'vitest';
import * as cheerio from 'cheerio';
import { assetCompressionRule } from './asset-compression.js';
import { imageEncodingRule } from './image-encoding.js';
import { minifyJsRule } from './minify-js.js';
import { minifyCssRule } from './minify-css.js';
import { assetContentLength, partitionBySizeKnown } from './asset-size.js';
import type { AssetInfo, AuditContext } from '../../types.js';

const HTML = '<html><body><p>Fixture</p></body></html>';

function createContext(assets?: AssetInfo[]): AuditContext {
  return {
    url: 'https://example.com/',
    html: HTML,
    $: cheerio.load(HTML),
    headers: {},
    links: [],
    images: [],
    statusCode: 200,
    responseTime: 100,
    cwv: {},
    invalidLinks: [],
    specialLinks: [],
    figures: [],
    inlineSvgs: [],
    pictureElements: [],
    ...(assets && { assets }),
  };
}

function createAsset(overrides: Partial<AssetInfo>): AssetInfo {
  return {
    url: 'https://example.com/app.js',
    resourceType: 'script',
    statusCode: 200,
    headers: {},
    redirectChain: [],
    redirectLoop: false,
    ...overrides,
  };
}

describe('assetContentLength', () => {
  it('reads the header when present', () => {
    expect(assetContentLength(createAsset({ headers: { 'content-length': '4096' } }))).toBe(4096);
  });

  it('returns null rather than a sentinel when the header is absent', () => {
    expect(assetContentLength(createAsset({ headers: {} }))).toBeNull();
  });

  it('returns null for an unparseable header instead of NaN', () => {
    expect(assetContentLength(createAsset({ headers: { 'content-length': 'chunked' } }))).toBeNull();
  });

  it('reads a zero-byte asset as 0, not as unknown', () => {
    expect(assetContentLength(createAsset({ headers: { 'content-length': '0' } }))).toBe(0);
  });
});

describe('partitionBySizeKnown', () => {
  it('separates sized assets from unsized ones', () => {
    const { sized, unsized } = partitionBySizeKnown([
      createAsset({ url: 'https://example.com/a.js', headers: { 'content-length': '5000' } }),
      createAsset({ url: 'https://example.com/b.js', headers: {} }),
    ]);
    expect(sized.map((a) => a.url)).toEqual(['https://example.com/a.js']);
    expect(unsized.map((a) => a.url)).toEqual(['https://example.com/b.js']);
  });

  it('returns two empty lists for no candidates', () => {
    expect(partitionBySizeKnown([])).toEqual({ sized: [], unsized: [] });
  });
});

describe('perf-asset-compression — unknown size (ISSUE-001)', () => {
  it('is not measured when an uncompressed text asset carries no content-length', async () => {
    const result = await assetCompressionRule.run(
      createContext([
        createAsset({ headers: { 'content-type': 'text/javascript' } }),
      ])
    );
    expect(result.weight).toBe(0);
    expect(result.message).not.toContain('All sizable text assets');
    expect(result.details?.unsizedCount).toBe(1);
  });

  it('still passes when every text asset is compressed, sized or not', async () => {
    const result = await assetCompressionRule.run(
      createContext([createAsset({ headers: { 'content-encoding': 'br' } })])
    );
    expect(result.status).toBe('pass');
    expect(result.weight).not.toBe(0);
  });

  it('warns on a provable offender and discloses the unsized remainder', async () => {
    const result = await assetCompressionRule.run(
      createContext([
        createAsset({
          url: 'https://example.com/big.js',
          headers: { 'content-length': '150000', 'content-type': 'text/javascript' },
        }),
        createAsset({ url: 'https://example.com/unknown.js', headers: {} }),
      ])
    );
    expect(result.status).toBe('warn');
    expect(result.weight).not.toBe(0);
    expect(result.message).toContain('without compression');
    expect(result.message).toContain('content-length');
    expect(result.details?.unsizedCount).toBe(1);
  });
});

describe('perf-minify-css — unknown size (ISSUE-001)', () => {
  it('is not measured when a non-.min stylesheet carries no content-length', async () => {
    const result = await minifyCssRule.run(
      createContext([
        createAsset({ url: 'https://example.com/site.css', resourceType: 'stylesheet' }),
      ])
    );
    expect(result.weight).toBe(0);
    expect(result.details?.unsizedCount).toBe(1);
  });

  it('passes when the only stylesheet is already marked .min', async () => {
    const result = await minifyCssRule.run(
      createContext([
        createAsset({ url: 'https://example.com/site.min.css', resourceType: 'stylesheet' }),
      ])
    );
    expect(result.status).toBe('pass');
    expect(result.weight).not.toBe(0);
  });
});

describe('perf-minify-js — unknown size (ISSUE-001)', () => {
  it('is not measured when a non-.min script carries no content-length', async () => {
    const result = await minifyJsRule.run(
      createContext([createAsset({ url: 'https://example.com/bundle.js' })])
    );
    expect(result.weight).toBe(0);
    expect(result.details?.unsizedCount).toBe(1);
  });

  it('keeps the sized suspect and reports the unsized script alongside it', async () => {
    const result = await minifyJsRule.run(
      createContext([
        createAsset({
          url: 'https://example.com/big.js',
          headers: { 'content-length': '90000' },
        }),
        createAsset({ url: 'https://example.com/unknown.js' }),
      ])
    );
    expect(result.status).toBe('warn');
    expect(result.weight).not.toBe(0);
    expect(result.message).toContain('big.js');
    expect(result.message).toContain('content-length');
  });
});

describe('perf-image-encoding — unknown size (ISSUE-001)', () => {
  it('is not measured when an image carries no content-length', async () => {
    const result = await imageEncodingRule.run(
      createContext([
        createAsset({
          url: 'https://example.com/hero.webp',
          resourceType: 'image',
          headers: { 'content-type': 'image/webp' },
        }),
      ])
    );
    expect(result.weight).toBe(0);
    expect(result.message).not.toContain('reasonably sized');
    expect(result.details?.unsizedCount).toBe(1);
  });

  it('still fails on a legacy format even when the size is unknown', async () => {
    const result = await imageEncodingRule.run(
      createContext([
        createAsset({
          url: 'https://example.com/scan.tiff',
          resourceType: 'image',
          headers: { 'content-type': 'image/tiff' },
        }),
      ])
    );
    expect(result.status).toBe('fail');
    expect(result.weight).not.toBe(0);
  });

  it('passes when every image is sized and within budget', async () => {
    const result = await imageEncodingRule.run(
      createContext([
        createAsset({
          url: 'https://example.com/hero.webp',
          resourceType: 'image',
          headers: { 'content-type': 'image/webp', 'content-length': '40000' },
        }),
      ])
    );
    expect(result.status).toBe('pass');
    expect(result.weight).not.toBe(0);
  });
});
