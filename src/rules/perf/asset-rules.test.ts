import { describe, it, expect } from 'vitest';
import * as cheerio from 'cheerio';
import { assetCachePolicyRule } from './asset-cache-policy.js';
import { assetCompressionRule } from './asset-compression.js';
import { imageEncodingRule } from './image-encoding.js';
import { minifyJsRule } from './minify-js.js';
import { minifyCssRule } from './minify-css.js';
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

describe('perf-asset-cache-policy', () => {
  it('is not measured when no asset data was collected', async () => {
    const result = await assetCachePolicyRule.run(createContext());
    expect(result.weight).toBe(0);
    expect(result.status).toBe('warn');
  });

  it('passes when static assets carry a max-age of at least 1 hour', async () => {
    const result = await assetCachePolicyRule.run(
      createContext([
        createAsset({ headers: { 'cache-control': 'public, max-age=31536000' } }),
        createAsset({
          url: 'https://example.com/logo.png',
          resourceType: 'image',
          headers: { 'cache-control': 'public, max-age=86400, immutable' },
        }),
      ])
    );
    expect(result.status).toBe('pass');
  });

  it('warns when a static asset has no cache-control header', async () => {
    const result = await assetCachePolicyRule.run(
      createContext([createAsset({ headers: {} })])
    );
    expect(result.status).toBe('warn');
    expect(result.message).toContain('no cache-control');
    expect(result.details?.uncachedCount).toBe(1);
  });

  it('warns when max-age is under 1 hour', async () => {
    const result = await assetCachePolicyRule.run(
      createContext([createAsset({ headers: { 'cache-control': 'public, max-age=300' } })])
    );
    expect(result.status).toBe('warn');
    expect(result.message).toContain('max-age=300s');
  });

  it('passes when no static assets were observed', async () => {
    const result = await assetCachePolicyRule.run(
      createContext([createAsset({ resourceType: 'xhr', headers: {} })])
    );
    expect(result.status).toBe('pass');
  });
});

describe('perf-asset-compression', () => {
  it('is not measured when no asset data was collected', async () => {
    const result = await assetCompressionRule.run(createContext());
    expect(result.weight).toBe(0);
    expect(result.status).toBe('warn');
  });

  it('passes when text assets are served compressed', async () => {
    const result = await assetCompressionRule.run(
      createContext([
        createAsset({
          headers: { 'content-length': '60000', 'content-encoding': 'gzip' },
        }),
        createAsset({
          url: 'https://example.com/app.css',
          resourceType: 'stylesheet',
          headers: { 'content-length': '30000', 'content-encoding': 'br' },
        }),
      ])
    );
    expect(result.status).toBe('pass');
  });

  it('passes when uncompressed text assets are below 2KB', async () => {
    const result = await assetCompressionRule.run(
      createContext([createAsset({ headers: { 'content-length': '900' } })])
    );
    expect(result.status).toBe('pass');
  });

  it('warns on large text assets served without compression', async () => {
    const result = await assetCompressionRule.run(
      createContext([
        createAsset({
          headers: { 'content-length': '150000', 'content-type': 'text/javascript' },
        }),
      ])
    );
    expect(result.status).toBe('warn');
    expect(result.message).toContain('without compression');
    expect(result.details?.uncompressedCount).toBe(1);
  });

  it('ignores binary assets such as images', async () => {
    const result = await assetCompressionRule.run(
      createContext([
        createAsset({
          url: 'https://example.com/photo.jpg',
          resourceType: 'image',
          headers: { 'content-length': '500000', 'content-type': 'image/jpeg' },
        }),
      ])
    );
    expect(result.status).toBe('pass');
  });
});

describe('perf-image-encoding', () => {
  it('is not measured when no asset data was collected', async () => {
    const result = await imageEncodingRule.run(createContext());
    expect(result.weight).toBe(0);
    expect(result.status).toBe('warn');
  });

  it('passes for reasonably sized modern images', async () => {
    const result = await imageEncodingRule.run(
      createContext([
        createAsset({
          url: 'https://example.com/hero.webp',
          resourceType: 'image',
          headers: { 'content-length': '40000', 'content-type': 'image/webp' },
        }),
      ])
    );
    expect(result.status).toBe('pass');
  });

  it('warns on images transferred over 100KB', async () => {
    const result = await imageEncodingRule.run(
      createContext([
        createAsset({
          url: 'https://example.com/hero.jpg',
          resourceType: 'image',
          headers: { 'content-length': '250000', 'content-type': 'image/jpeg' },
        }),
      ])
    );
    expect(result.status).toBe('warn');
    expect(result.message).toContain('100KB');
    expect(result.details?.oversizedCount).toBe(1);
  });

  it('fails on legacy formats detected via content-type', async () => {
    const result = await imageEncodingRule.run(
      createContext([
        createAsset({
          url: 'https://example.com/picture',
          resourceType: 'image',
          headers: { 'content-length': '9000', 'content-type': 'image/bmp' },
        }),
      ])
    );
    expect(result.status).toBe('fail');
    expect(result.message).toContain('BMP/TIFF');
  });

  it('fails on legacy formats detected via file extension', async () => {
    const result = await imageEncodingRule.run(
      createContext([
        createAsset({
          url: 'https://example.com/scan.tiff?x=1',
          resourceType: 'image',
          headers: { 'content-length': '9000', 'content-type': 'image/octet-stream' },
        }),
      ])
    );
    expect(result.status).toBe('fail');
  });

  it('passes when no images were observed', async () => {
    const result = await imageEncodingRule.run(createContext([createAsset({ headers: {} })]));
    expect(result.status).toBe('pass');
  });
});

describe('perf-minify-js external asset extension', () => {
  it('behaves exactly as before when no asset data was collected', async () => {
    const result = await minifyJsRule.run(createContext());
    expect(result.status).toBe('pass');
    expect(result.message).toBe('No inline JavaScript found');
    expect(result.details?.externalSuspects).toBeUndefined();
  });

  it('ignores large external scripts served from a .min. URL', async () => {
    const result = await minifyJsRule.run(
      createContext([
        createAsset({
          url: 'https://example.com/app.min.js',
          headers: { 'content-length': '200000' },
        }),
      ])
    );
    expect(result.status).toBe('pass');
  });

  it('warns on large external scripts without a .min. marker', async () => {
    const result = await minifyJsRule.run(
      createContext([
        createAsset({
          url: 'https://example.com/bundle.js',
          headers: { 'content-length': '200000' },
        }),
      ])
    );
    expect(result.status).toBe('warn');
    expect(result.message).toContain('heuristic');
    expect(result.message).toContain('bundle.js');
    expect(result.details?.externalSuspects).toEqual(['https://example.com/bundle.js']);
  });

  it('ignores small external scripts even without a .min. marker', async () => {
    const result = await minifyJsRule.run(
      createContext([
        createAsset({
          url: 'https://example.com/tiny.js',
          headers: { 'content-length': '800' },
        }),
      ])
    );
    expect(result.status).toBe('pass');
  });
});

describe('perf-minify-css external asset extension', () => {
  it('behaves exactly as before when no asset data was collected', async () => {
    const result = await minifyCssRule.run(createContext());
    expect(result.status).toBe('pass');
    expect(result.message).toBe('No inline CSS found');
    expect(result.details?.externalSuspects).toBeUndefined();
  });

  it('warns on large external stylesheets without a .min. marker', async () => {
    const result = await minifyCssRule.run(
      createContext([
        createAsset({
          url: 'https://example.com/styles.css',
          resourceType: 'stylesheet',
          headers: { 'content-length': '80000' },
        }),
      ])
    );
    expect(result.status).toBe('warn');
    expect(result.message).toContain('stylesheet');
    expect(result.message).toContain('styles.css');
  });

  it('ignores minified-looking external stylesheets', async () => {
    const result = await minifyCssRule.run(
      createContext([
        createAsset({
          url: 'https://example.com/styles.min.css',
          resourceType: 'stylesheet',
          headers: { 'content-length': '80000' },
        }),
      ])
    );
    expect(result.status).toBe('pass');
  });
});
