/**
 * Social card integrity: the share image is fetched, read and judged; social
 * tags are declared once, with the right attribute; share text is not shared
 * between pages.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { createTestContext, createTestSite } from '../test-context.js';
import { readImageHeader } from './image-header.js';
import { ogImageReachableRule } from './og-image-reachable.js';
import { socialMetaMultipleRule } from './meta-multiple.js';
import { twitterAttributeRule } from './twitter-attribute.js';
import { duplicateOgRule } from './duplicate-og.js';
import { UrlService } from '../../net/url-service.js';
import { EXTERNAL_LINKS_DISABLED } from '../../site/external-links.js';
import { avif, gif, jpeg, png, webp } from './image-fixtures.js';

const PAGE = 'https://example.com/post';
const SAME = 'https://example.com/card.png';
const OTHER = 'https://cdn.other.test/card.png';

type Answer = { body?: Uint8Array | string; status?: number; headers?: Record<string, string> };

function serve(answers: Record<string, Answer>) {
  const calls: Array<{ url: string; range?: string }> = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, range: (init?.headers as Record<string, string> | undefined)?.['Range'] });
      const answer = answers[url] ?? { status: 404 };
      return new Response((answer.body ?? null) as BodyInit | null, { status: answer.status ?? 200, headers: answer.headers ?? { 'content-type': 'image/png' } });
    })
  );
  return calls;
}

function page(head: string) {
  return createTestContext(`<html><head>${head}</head><body></body></html>`, { url: PAGE });
}
const og = (src: string) => `<meta property="og:image" content="${src}">`;

afterEach(() => vi.unstubAllGlobals());

describe('image headers', () => {
  it('reads the size of PNG, JPEG, GIF and the three WebP kinds', () => {
    expect(readImageHeader(png(1200, 630))).toEqual({ format: 'png', width: 1200, height: 630 });
    expect(readImageHeader(jpeg(800, 418))).toEqual({ format: 'jpeg', width: 800, height: 418 });
    expect(readImageHeader(gif(300, 157))).toEqual({ format: 'gif', width: 300, height: 157 });
    expect(readImageHeader(webp('VP8 ', 1200, 630))).toEqual({ format: 'webp', width: 1200, height: 630 });
    expect(readImageHeader(webp('VP8L', 1201, 631))).toEqual({ format: 'webp', width: 1201, height: 631 });
    expect(readImageHeader(webp('VP8X', 4000, 2094))).toEqual({ format: 'webp', width: 4000, height: 2094 });
  });

  it('knows AVIF and SVG without reading their size', () => {
    expect(readImageHeader(avif())).toEqual({ format: 'avif' });
    expect(readImageHeader(new TextEncoder().encode('<?xml version="1.0"?><svg width="10"></svg>'))).toEqual({ format: 'svg' });
    expect(readImageHeader(new TextEncoder().encode('<!doctype html><html>'))).toEqual({ format: 'unknown' });
  });
});

describe('social-og-image-reachable', () => {
  it('passes a 1200×630 PNG, read from a 64 KB range', async () => {
    const calls = serve({ [SAME]: { body: png(1200, 630) } });
    const result = await ogImageReachableRule.run(page(og(SAME)));
    expect(result.status).toBe('pass');
    expect(calls[0].range).toBe('bytes=0-65535');
  });

  it('fails an image that is gone', async () => {
    serve({});
    const result = await ogImageReachableRule.run(page(og(SAME)));
    expect(result.status).toBe('fail');
    expect(result.message).toContain('HTTP 404');
  });

  it('fails an HTML page served as the image', async () => {
    serve({ [SAME]: { body: '<!doctype html><html></html>', headers: { 'content-type': 'text/html' } } });
    const result = await ogImageReachableRule.run(page(og(SAME)));
    expect(result.status).toBe('fail');
    expect(result.message).toContain('not an image');
  });

  it('reads a 6 MB image size from the Content-Range total of a 206', async () => {
    serve({ [SAME]: { status: 206, body: png(1200, 630), headers: { 'content-type': 'image/png', 'content-range': 'bytes 0-65535/6291456' } } });
    const result = await ogImageReachableRule.run(page(og(SAME)));
    expect(result.status).toBe('fail');
    expect(result.message).toContain('6.0 MB');
  });

  it('checks status, type and size of an AVIF it cannot measure', async () => {
    serve({ [SAME]: { body: avif(), headers: { 'content-type': 'image/avif', 'content-length': '40000' } } });
    const result = await ogImageReachableRule.run(page(og(SAME)));
    expect(result.status).toBe('pass');
    expect(result.details?.images).toEqual([expect.objectContaining({ format: 'avif', bytes: 40000 })]);
  });

  it('fails an image under 600×315 and warns one under 1200×630', async () => {
    serve({ [SAME]: { body: png(400, 210) }, 'https://example.com/mid.png': { body: png(1000, 523) } });
    expect((await ogImageReachableRule.run(page(og(SAME)))).status).toBe('fail');
    expect((await ogImageReachableRule.run(page(og('https://example.com/mid.png')))).status).toBe('warn');
  });

  it('warns a ratio far from 1.91:1', async () => {
    serve({ [SAME]: { body: png(1200, 1200) } });
    const result = await ogImageReachableRule.run(page(og(SAME)));
    expect(result.status).toBe('warn');
    expect(result.message).toContain('1.91:1');
  });

  it('judges a summary card image as a square, and checks twitter:image alone', async () => {
    serve({ [SAME]: { body: png(400, 400) } });
    const result = await ogImageReachableRule.run(
      page(`<meta name="twitter:card" content="summary"><meta name="twitter:image" content="${SAME}">`)
    );
    expect(result.status).toBe('pass');
  });

  it('fails a broken image on another host, and cannot verify a refused one', async () => {
    serve({ [OTHER]: { status: 403 } });
    expect((await ogImageReachableRule.run(page(og(OTHER))))).toMatchObject({ status: 'not-measured', reason: 'could-not-verify' });
    serve({});
    expect((await ogImageReachableRule.run(page(og(OTHER)))).status).toBe('fail');
  });

  it('does not request an image on another host when external requests are off', async () => {
    const calls = serve({ [OTHER]: { body: png(1200, 630) } });
    const context = page(og(OTHER));
    context.externalLinks = EXTERNAL_LINKS_DISABLED;
    expect(await ogImageReachableRule.run(context)).toMatchObject({ status: 'not-measured', reason: 'disabled' });
    expect(calls).toHaveLength(0);
  });

  it('makes one request when 100 pages of a run share the image', async () => {
    const calls = serve({ [SAME]: { body: png(1200, 630) } });
    const urls = new UrlService({ siteUrl: PAGE });
    for (let i = 0; i < 100; i++) {
      const context = createTestContext(`<html><head>${og(SAME)}</head></html>`, { url: `https://example.com/p${i}` });
      context.urls = urls;
      await ogImageReachableRule.run(context);
    }
    expect(calls).toHaveLength(1);
  });

  it('is not measured without a share image', async () => {
    expect((await ogImageReachableRule.run(page('')))).toMatchObject({ status: 'not-measured', reason: 'not-applicable' });
  });
});

describe('social-meta-multiple', () => {
  it('warns about a property declared twice with different values', async () => {
    const result = await socialMetaMultipleRule.run(
      page('<meta property="og:title" content="A"><meta property="og:title" content="B">')
    );
    expect(result.status).toBe('warn');
    expect(result.message).toContain('og:title');
  });

  it('allows the arrays the protocol defines', async () => {
    const result = await socialMetaMultipleRule.run(
      page(`${og('/a.png')}${og('/b.png')}<meta property="og:image:width" content="1"><meta property="og:image:width" content="2"><meta property="og:locale:alternate" content="de_DE"><meta property="og:locale:alternate" content="fr_FR">`)
    );
    expect(result.status).toBe('pass');
  });
});

describe('social-twitter-attribute', () => {
  it('warns about twitter:* declared with property=', async () => {
    const result = await twitterAttributeRule.run(page('<meta property="twitter:card" content="summary">'));
    expect(result.status).toBe('warn');
  });

  it('passes name=, and is not measured without Twitter tags', async () => {
    expect((await twitterAttributeRule.run(page('<meta name="twitter:card" content="summary">'))).status).toBe('pass');
    expect((await twitterAttributeRule.run(page(''))).status).toBe('not-measured');
  });
});

describe('social-duplicate-og', () => {
  it('warns when another page shares the og:title, and not across ineligible pages', async () => {
    const html = (title: string, extra = '') =>
      `<html><head><title>${title}</title><meta property="og:title" content="Same share title">${extra}</head><body></body></html>`;
    const { contexts } = await createTestSite([
      { url: 'https://example.com/a', html: html('A') },
      { url: 'https://example.com/b', html: html('B') },
      { url: 'https://example.com/c', html: html('C', '<meta name="robots" content="noindex">') },
    ]);
    const a = await duplicateOgRule.run(contexts.get('https://example.com/a')!);
    expect(a.status).toBe('warn');
    expect(a.details?.sameTitleUrls).toEqual(['https://example.com/b']);
    expect((await duplicateOgRule.run(contexts.get('https://example.com/c')!)).status).toBe('not-measured');
  });

  it('is not measured on a single page', async () => {
    expect((await duplicateOgRule.run(page('<meta property="og:title" content="x">'))).status).toBe('not-measured');
  });
});
