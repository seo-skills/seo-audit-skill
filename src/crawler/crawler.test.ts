import { describe, it, expect } from 'vitest';
import * as cheerio from 'cheerio';
import { Crawler, type CrawledPage } from './crawler.js';
import { createAuditContext } from './fetcher.js';
import { RobotsMatcher } from './robots.js';

/**
 * Tests for buildSiteContext, and in particular the per-URL `pages` map that
 * lets crawl-mode rules answer cross-page questions (sitemap URL status,
 * canonical/hreflang target indexability).
 *
 * The crawler's private state is injected directly so no network is involved.
 */

const HOME = 'https://example.com/';
const ABOUT = 'https://example.com/about';

function makePage(
  url: string,
  html: string,
  options: { statusCode?: number; headers?: Record<string, string>; error?: string } = {}
): CrawledPage {
  const context = createAuditContext(
    url,
    {
      html,
      $: cheerio.load(html),
      headers: options.headers ?? {},
      statusCode: options.statusCode ?? 200,
      responseTime: 1,
    },
    {}
  );
  return { url, context, ...(options.error !== undefined && { error: options.error }) };
}

/** Build a crawler whose crawl results are the given pages. */
function crawlerWith(pages: CrawledPage[], robots: RobotsMatcher | null = null): Crawler {
  const crawler = new Crawler();
  // Inject crawl results directly so no network is involved.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const priv = crawler as any;
  priv.results = pages;
  priv.entryUrl = pages[0] ? priv.normalizeUrl(pages[0].url) : '';
  priv.robots = robots;
  return crawler;
}

describe('buildSiteContext pages map', () => {
  it('records status, canonical, robots flags, hreflang and h1 from the page HTML', () => {
    const html = `<html><head>
      <link rel="canonical" href="/about">
      <meta name="robots" content="noindex, nofollow">
      <link rel="alternate" hreflang="en" href="https://example.com/en/about">
      <link rel="alternate" hreflang="de" href="/de/uber-uns">
      </head><body><h1>  About us  </h1></body></html>`;

    const site = crawlerWith([makePage(ABOUT, html)]).buildSiteContext();
    const info = site.pages!.get(ABOUT);

    expect(info).toBeDefined();
    expect(info!.statusCode).toBe(200);
    // Resolved against the page URL, not kept relative.
    expect(info!.canonical).toBe('https://example.com/about');
    expect(info!.noindex).toBe(true);
    expect(info!.nofollow).toBe(true);
    expect(info!.hreflangOut).toEqual({
      en: 'https://example.com/en/about',
      de: 'https://example.com/de/uber-uns',
    });
    expect(info!.h1).toBe('About us');
  });

  it('reads noindex from the X-Robots-Tag header too', () => {
    const site = crawlerWith([
      makePage(ABOUT, '<html></html>', { headers: { 'x-robots-tag': 'noindex' } }),
    ]).buildSiteContext();

    expect(site.pages!.get(ABOUT)!.noindex).toBe(true);
    expect(site.pages!.get(ABOUT)!.nofollow).toBe(false);
  });

  it('treats "none" as noindex and nofollow', () => {
    const site = crawlerWith([
      makePage(ABOUT, '<html><head><meta name="robots" content="none"></head></html>'),
    ]).buildSiteContext();

    expect(site.pages!.get(ABOUT)!.noindex).toBe(true);
    expect(site.pages!.get(ABOUT)!.nofollow).toBe(true);
  });

  it('distinguishes an absent canonical from an unresolvable one', () => {
    const absent = crawlerWith([makePage(ABOUT, '<html></html>')]).buildSiteContext();
    expect(absent.pages!.get(ABOUT)!.canonical).toBeUndefined();

    const broken = crawlerWith([
      makePage(ABOUT, '<html><head><link rel="canonical" href="http://[bad"></head></html>'),
    ]).buildSiteContext();
    expect(broken.pages!.get(ABOUT)!.canonical).toBeNull();
  });

  it('omits h1 when the page has none, and hreflangOut is empty without alternates', () => {
    const site = crawlerWith([makePage(ABOUT, '<html><body><p>hi</p></body></html>')]).buildSiteContext();
    const info = site.pages!.get(ABOUT)!;
    expect(info.h1).toBeUndefined();
    expect(info.hreflangOut).toEqual({});
  });

  it('keeps a non-2xx page with its real status code', () => {
    const site = crawlerWith([
      makePage(HOME, '<html><body>ok</body></html>'),
      makePage('https://example.com/gone', '<html><body>not found</body></html>', { statusCode: 404 }),
    ]).buildSiteContext();

    expect(site.pages!.get('https://example.com/gone')!.statusCode).toBe(404);
  });

  it('records errored pages with statusCode 0 but excludes them from the link graph', () => {
    const failed: CrawledPage = {
      url: 'https://example.com/timeout',
      context: createAuditContext(
        'https://example.com/timeout',
        { html: '', $: cheerio.load(''), headers: {}, statusCode: 0, responseTime: 0 },
        {}
      ),
      error: 'Request timed out',
    };

    const site = crawlerWith([makePage(HOME, '<html><body>ok</body></html>'), failed]).buildSiteContext();

    const info = site.pages!.get('https://example.com/timeout');
    expect(info).toBeDefined();
    expect(info!.statusCode).toBe(0);
    expect(info!.canonical).toBeUndefined();
    expect(info!.noindex).toBe(false);
    // Errored pages never counted as crawled and have no outbound edges.
    expect(site.pageCount).toBe(1);
    expect(site.outboundLinksByUrl.has('https://example.com/timeout')).toBe(false);
  });

  it('marks robots.txt-disallowed URLs when a matcher is available', () => {
    const robots = new RobotsMatcher('User-agent: *\nDisallow: /blocked', 'seomator-test');
    const blocked = 'https://example.com/blocked/page';

    const site = crawlerWith(
      [makePage(HOME, '<html></html>'), makePage(blocked, '<html></html>')],
      robots
    ).buildSiteContext();

    expect(site.pages!.get(blocked)!.disallowed).toBe(true);
    expect(site.pages!.get(HOME)!.disallowed).toBe(false);
  });

  it('reports disallowed as false when robots.txt was never applied', () => {
    // respectRobots off or robots.txt unreachable: the answer is unknown, not
    // "disallowed", so rules must see false.
    const site = crawlerWith([makePage(ABOUT, '<html></html>')], null).buildSiteContext();
    expect(site.pages!.get(ABOUT)!.disallowed).toBe(false);
  });

  it('keys the pages map by normalised URL', () => {
    const site = crawlerWith([
      makePage('https://example.com/about?utm_source=x#top', '<html></html>'),
    ]).buildSiteContext();

    expect(site.pages!.get(ABOUT)).toBeDefined();
    expect(site.pages!.has('https://example.com/about?utm_source=x#top')).toBe(false);
  });
});
