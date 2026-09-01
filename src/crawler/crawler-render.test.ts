import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as cheerio from 'cheerio';

/**
 * The rendered DOM has to survive the trip from the browser to the audit
 * context, or every JS-rendering rule reports "rendered DOM not available" on a
 * crawl that did render the page.
 *
 * `fetchPage` is stubbed so no network is involved; `createAuditContext` stays
 * real, since attaching to the context it builds is the thing under test.
 */
const RAW_HTML = '<html><head><title>Raw</title></head><body><h1>Raw</h1></body></html>';
const RENDERED_HTML =
  '<html><head><title>Rendered</title></head><body><h1>Rendered</h1><a href="/x">x</a></body></html>';

vi.mock('./fetcher.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./fetcher.js')>();
  return {
    ...actual,
    fetchPage: vi.fn(async () => ({
      html: RAW_HTML,
      $: cheerio.load(RAW_HTML),
      headers: { 'content-type': 'text/html' },
      statusCode: 200,
      responseTime: 1,
    })),
  };
});

const { Crawler } = await import('./crawler.js');

/** Crawl a single page with the given renderer and return its context. */
async function crawlOnce(renderPage?: (url: string) => Promise<Record<string, unknown>>) {
  const crawler = new Crawler({
    maxPages: 1,
    concurrency: 1,
    respectRobots: false,
    ...(renderPage && { renderPage: renderPage as never }),
  });
  const pages = await crawler.crawl('https://example.com/');
  return pages[0].context;
}

beforeEach(() => vi.clearAllMocks());

describe('Crawler — rendered DOM reaches the audit context', () => {
  it('attaches renderedHtml and a parsed rendered$ when the renderer returns html', async () => {
    const context = await crawlOnce(async () => ({ cwv: {}, html: RENDERED_HTML }));

    expect(context.renderedHtml).toBe(RENDERED_HTML);
    expect(context.rendered$).toBeDefined();
    expect(context.rendered$!('h1').text()).toBe('Rendered');
  });

  it('keeps the HTTP response as the raw html, so the two can be compared', async () => {
    const context = await crawlOnce(async () => ({ cwv: {}, html: RENDERED_HTML }));

    // The JS-rendering rules diff these two. Overwriting the raw response with
    // the rendered DOM would make every mismatch rule silently pass.
    expect(context.html).toBe(RAW_HTML);
    expect(context.$('h1').text()).toBe('Raw');
    expect(context.renderedHtml).not.toBe(context.html);
  });

  it('leaves the rendered DOM unset when the renderer omits html', async () => {
    const context = await crawlOnce(async () => ({ cwv: { lcp: 1 } }));

    expect(context.renderedHtml).toBeUndefined();
    expect(context.rendered$).toBeUndefined();
    expect(context.cwv?.lcp).toBe(1);
  });

  it('leaves the rendered DOM unset when no renderer is configured', async () => {
    const context = await crawlOnce();

    expect(context.renderedHtml).toBeUndefined();
    expect(context.rendered$).toBeUndefined();
  });

  it('survives a renderer that throws, keeping the HTTP response', async () => {
    const context = await crawlOnce(async () => {
      throw new Error('browser crashed');
    });

    expect(context.renderedHtml).toBeUndefined();
    expect(context.html).toBe(RAW_HTML);
  });
});
