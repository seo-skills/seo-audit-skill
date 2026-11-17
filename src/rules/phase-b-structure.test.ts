/**
 * Document structure from raw source, sitemap coverage, and legacy or
 * alternate URL patterns.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { createTestContext, createTestSite, type TestPage } from './test-context.js';
import { scanSource } from './htmlval/source-scanner.js';
import { bodyStructureRule } from './htmlval/body-structure.js';
import { indexableNotInSitemapRule } from './crawl/indexable-not-in-sitemap.js';
import { ajaxCrawlingSchemeRule } from './js/ajax-crawling-scheme.js';
import { separateUrlsRule } from './mobile/separate-urls.js';
import { ampPairingRule } from './technical/amp-pairing.js';
import type { LinkInfo } from '../types.js';

afterEach(() => vi.unstubAllGlobals());

const structure = (html: string) => bodyStructureRule.run(createTestContext(html));

describe('the source scanner', () => {
  it('blanks comments, attribute values and raw text, keeping every offset', () => {
    const html = '<p title="<body>">x</p><!-- <body> --><textarea><body></textarea><script>"<body>"</script>';
    const { masked, tags } = scanSource(html);
    expect(masked).toHaveLength(html.length);
    expect(masked).not.toContain('<body');
    expect(tags.filter((t) => !t.closing).map((t) => t.name)).toEqual(['p', 'textarea', 'script']);
  });
});

describe('htmlval-body-structure', () => {
  it('fails a second <body>, naming where it starts', async () => {
    const html = '<html><head></head><body>a</body><body>b</body></html>';
    const result = await structure(html);
    expect(result.status).toBe('fail');
    expect(result.details?.problems).toEqual([expect.objectContaining({ case: 'multiple-body', offset: html.indexOf('<body>b') })]);
  });

  it('fails a <body> before <html>', async () => {
    const result = await structure('<body><html><head></head></html>');
    expect(result.details?.problems).toEqual([expect.objectContaining({ case: 'body-before-html' })]);
  });

  it('fails an element or text between <html> and <head>', async () => {
    expect((await structure('<html><div>x</div><head></head><body></body></html>')).details?.problems).toEqual([
      expect.objectContaining({ case: 'content-before-head', message: 'an element between <html> and <head>' }),
    ]);
    expect((await structure('<html>stray<head></head></html>')).status).toBe('fail');
  });

  it('passes "<body" inside a script string, a comment, a textarea and an attribute value', async () => {
    const html = `<html><!-- note --><head><script>document.write("<body>")</script></head>
      <body><!-- <body> --><textarea><body></textarea><a title="<body>">x</a></body></html>`;
    expect((await structure(html)).status).toBe('pass');
  });

  it('passes a document that leaves out <html>, <head> and <body>', async () => {
    expect((await structure('<!doctype html><title>t</title><p>Hello</p>')).status).toBe('pass');
  });
});

describe('crawl-indexable-not-in-sitemap', () => {
  const html = (head = '') => `<html><head><title>t</title>${head}</head><body></body></html>`;

  it('flags exactly the 2 of 10 indexable pages the sitemap leaves out, and not a noindex page', async () => {
    const pages: TestPage[] = Array.from({ length: 10 }, (_, i) => ({ url: `https://example.com/p${i}`, html: html() }));
    pages.push({ url: 'https://example.com/private', html: html('<meta name="robots" content="noindex">') });
    const { contexts } = await createTestSite(pages);
    const sitemapUrls = pages.slice(0, 8).map((p) => p.url);

    const statuses = new Map<string, string>();
    for (const [url, context] of contexts) {
      context.sitemapUrls = sitemapUrls;
      context.sitemapComplete = true;
      statuses.set(url, (await indexableNotInSitemapRule.run(context)).status);
    }
    expect([...statuses].filter(([, s]) => s === 'warn').map(([u]) => u)).toEqual(['https://example.com/p8', 'https://example.com/p9']);
    expect(statuses.get('https://example.com/private')).toBe('not-measured');
  });

  it('is not measured when the sitemap was read only in part', async () => {
    const { contexts } = await createTestSite([{ url: 'https://example.com/a', html: html() }]);
    const context = contexts.get('https://example.com/a')!;
    context.sitemapUrls = ['https://example.com/b'];
    context.sitemapComplete = false;
    context.sitemapGaps = [{ kind: 'unread', url: 'https://example.com/more.xml' }];
    expect(await indexableNotInSitemapRule.run(context)).toMatchObject({ status: 'not-measured', reason: 'could-not-verify' });
  });
});

describe('js-ajax-crawling-scheme', () => {
  const link = (href: string): LinkInfo => ({ href, text: 'x', isInternal: true, isNoFollow: false });

  it('fails #! links and the fragment meta tag', async () => {
    const withLinks = createTestContext('<html></html>', { links: [link('https://example.com/#!/products')] });
    expect((await ajaxCrawlingSchemeRule.run(withLinks)).status).toBe('fail');
    const withMeta = createTestContext('<html><head><meta name="fragment" content="!"></head></html>');
    expect((await ajaxCrawlingSchemeRule.run(withMeta)).status).toBe('fail');
  });

  it('ignores a bare #! placeholder', async () => {
    const context = createTestContext('<html></html>', { links: [link('https://example.com/page#!')] });
    expect((await ajaxCrawlingSchemeRule.run(context)).status).toBe('not-measured');
  });
});

/** Stub pages by URL: status and HTML */
function serve(pages: Record<string, { status?: number; html?: string }>) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const page = pages[String(input)];
      return new Response(page?.html ?? '', { status: page ? (page.status ?? 200) : 404, headers: { 'content-type': 'text/html' } });
    })
  );
}

const DESKTOP = 'https://example.com/page';
const canonical = (href: string, extra = '') => `<html><head><link rel="canonical" href="${href}">${extra}</head></html>`;

describe('mobile-separate-urls', () => {
  const page = (media = 'only screen and (max-width: 640px)') =>
    createTestContext(`<html><head><link rel="alternate" media="${media}" href="https://m.example.com/page"></head></html>`, { url: DESKTOP });

  it('passes a mobile page that names this page as canonical', async () => {
    serve({ 'https://m.example.com/page': { html: canonical(DESKTOP) } });
    expect((await separateUrlsRule.run(page())).status).toBe('pass');
  });

  it('warns a mobile page without the canonical back', async () => {
    serve({ 'https://m.example.com/page': { html: canonical('https://m.example.com/page') } });
    expect((await separateUrlsRule.run(page())).status).toBe('warn');
  });

  it('fails a mobile page that is gone, and cannot verify one that refuses', async () => {
    serve({});
    expect((await separateUrlsRule.run(page())).status).toBe('fail');
    serve({ 'https://m.example.com/page': { status: 403 } });
    expect((await separateUrlsRule.run(page()))).toMatchObject({ status: 'not-measured', reason: 'could-not-verify' });
  });

  it('is not measured without a mobile alternate, or for a wider breakpoint', async () => {
    expect((await separateUrlsRule.run(createTestContext('<html></html>'))).status).toBe('not-measured');
    expect((await separateUrlsRule.run(page('(max-width: 1024px)'))).status).toBe('not-measured');
  });
});

describe('technical-amp-pairing', () => {
  const AMP = 'https://example.com/page/amp';
  const page = () => createTestContext(`<html><head><link rel="amphtml" href="${AMP}"></head></html>`, { url: DESKTOP });

  it('passes an AMP page that names this page as canonical', async () => {
    serve({ [AMP]: { html: canonical(DESKTOP) } });
    expect((await ampPairingRule.run(page())).status).toBe('pass');
  });

  it('warns an AMP page indexable on its own, and fails one that is noindex or names no canonical', async () => {
    serve({ [AMP]: { html: canonical(AMP) } });
    expect((await ampPairingRule.run(page())).status).toBe('warn');
    serve({ [AMP]: { html: canonical(AMP, '<meta name="robots" content="noindex">') } });
    expect((await ampPairingRule.run(page())).status).toBe('fail');
    serve({ [AMP]: { html: '<html><head></head></html>' } });
    expect((await ampPairingRule.run(page())).status).toBe('fail');
  });

  it('fails an AMP page that is gone, and is not measured without one', async () => {
    serve({});
    expect((await ampPairingRule.run(page())).status).toBe('fail');
    expect((await ampPairingRule.run(createTestContext('<html></html>'))).status).toBe('not-measured');
  });
});
