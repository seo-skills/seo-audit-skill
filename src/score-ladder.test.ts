/**
 * The score ladder: the overall score separates pages that cannot rank from
 * pages that can.
 *
 * Before page-level caps, it did not. On one well-configured server a page
 * Google is told not to index scored 94, a page holding the single word "x"
 * scored 85, a page with one four-word sentence 92, and a full article 95.
 * Server checks read the same on every page and carried most of the weight,
 * so every page on a good server looked good.
 *
 * Each rung is the article page with one thing taken away, all served by the
 * same stubbed server, so the only difference between two scores is the page.
 * The assertions are bands and an order, not pinned numbers: a rule change
 * may move a score a point, but must not let a broken page pass.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { Auditor } from './auditor.js';
import { calculateOverallScore } from './scoring.js';
import { categories } from './categories/index.js';
import type { AuditResult } from './types.js';

const ORIGIN = 'https://ladder.test';

const paragraph = (n: number) =>
  `<p>Widgets are small mechanical parts used on assembly lines across many industries, and section ${n} explains how our engineers choose materials, test tolerances, and ship orders on time to customers who depend on a reliable supply.</p>`;

function head(path: string, { title = true, robots = '' } = {}): string {
  return `<head>
  <meta charset="utf-8">
  ${robots}
  ${title ? '<title>Industrial Widgets — Acme Supply</title>' : ''}
  <meta name="description" content="How Acme Supply makes industrial widgets: materials, tolerances, testing and delivery, explained by the engineers who build them.">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="canonical" href="${ORIGIN}${path}">
  <link rel="icon" href="/favicon.ico">
  <meta property="og:title" content="Industrial Widgets">
  <meta property="og:description" content="How Acme builds industrial widgets.">
  <meta property="og:image" content="${ORIGIN}/og.png">
  <meta property="og:url" content="${ORIGIN}${path}">
  <meta name="twitter:card" content="summary_large_image">
  <script type="application/ld+json">{"@context":"https://schema.org","@type":"Article","headline":"Industrial Widgets","author":{"@type":"Person","name":"Jane Doe"},"datePublished":"2026-01-10","image":"${ORIGIN}/og.png","publisher":{"@type":"Organization","name":"Acme Supply","logo":{"@type":"ImageObject","url":"${ORIGIN}/logo.png"}}}</script>
</head>`;
}

function article(path: string, options: { title?: boolean; robots?: string } = {}): string {
  return `<!doctype html>
<html lang="en">
${head(path, options)}
<body>
  <header><nav><a href="/">Home</a> <a href="/about">About</a> <a href="/contact">Contact</a></nav></header>
  <main>
    <article>
      <h1>Industrial Widgets</h1>
      <p>By <a href="/about" rel="author">Jane Doe</a>, materials engineer</p>
      ${[1, 2, 3, 4, 5, 6, 7, 8].map(paragraph).join('\n')}
      <h2>How we test</h2>
      <img src="/test-rig.jpg" alt="Widget tolerance test rig" width="800" height="450">
      ${[9, 10, 11, 12, 13, 14].map(paragraph).join('\n')}
      <h2>Ordering</h2>
      <p>See <a href="/contact">contact</a> or read the <a href="https://www.iso.org/standards.html">ISO standards</a>.</p>
    </article>
  </main>
  <footer><a href="/privacy">Privacy</a> <a href="/about">About</a> © 2026 Acme Supply</footer>
</body>
</html>`;
}

const PAGES: Record<string, string> = {
  '/good': article('/good'),
  '/noindex': article('/noindex', { robots: '<meta name="robots" content="noindex">' }),
  '/private/good': article('/private/good'),
  '/untitled': article('/untitled', { title: false }),
  '/thin': `<!doctype html>
<html lang="en">
${head('/thin')}
<body><main><h1>Industrial Widgets</h1><p>We sell widgets.</p></main></body>
</html>`,
  '/blank': '<html><body><p>x</p></body></html>',
};

// Every page gets the same server: the headers a well-configured site sends.
const HEADERS = {
  'content-type': 'text/html; charset=utf-8',
  'strict-transport-security': 'max-age=31536000; includeSubDomains',
  'x-frame-options': 'DENY',
  'x-content-type-options': 'nosniff',
  'content-security-policy': "default-src 'self'",
  'referrer-policy': 'strict-origin-when-cross-origin',
  'permissions-policy': 'camera=()',
};
const ROBOTS = `User-agent: *\nDisallow: /private/\nSitemap: ${ORIGIN}/sitemap.xml\n`;
const SITEMAP = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${Object.keys(PAGES)
  .map((path) => `<url><loc>${ORIGIN}${path}</loc></url>`)
  .join('')}</urlset>`;

function ladderFetch() {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const head = (init?.method ?? 'GET') === 'HEAD';
    const path = url.startsWith(ORIGIN) ? url.slice(ORIGIN.length) || '/' : null;
    if (path === null) return new Response(null, { status: 404 });

    const html = PAGES[path] ?? (['/', '/about', '/contact', '/privacy'].includes(path) ? PAGES['/good'] : undefined);
    if (html) return new Response(head ? null : html, { status: 200, headers: HEADERS });
    if (path === '/robots.txt') return new Response(ROBOTS, { status: 200, headers: { 'content-type': 'text/plain' } });
    if (path === '/sitemap.xml') return new Response(SITEMAP, { status: 200, headers: { 'content-type': 'application/xml' } });
    if (/\.(jpg|png|ico)$/.test(path)) {
      return new Response(head ? null : 'x', { status: 200, headers: { 'content-type': 'image/png', 'content-length': '30000' } });
    }
    return new Response(null, { status: 404 });
  });
}

describe('the score ladder', () => {
  const results = new Map<string, AuditResult>();
  const score = (path: string) => results.get(path)!.overallScore;
  const capIds = (path: string) => results.get(path)!.scoreCap?.caps.map((cap) => cap.id) ?? [];

  beforeAll(async () => {
    vi.stubGlobal('fetch', ladderFetch());
    for (const path of Object.keys(PAGES)) {
      results.set(path, await new Auditor({ measureCwv: false }).audit(`${ORIGIN}${path}`));
    }
  }, 60_000);

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it('lets a complete page through uncapped, in the top bands', () => {
    expect(results.get('/good')!.scoreCap).toBeUndefined();
    expect(score('/good')).toBeGreaterThanOrEqual(85);
  });

  it('fails a page Google is told not to index, and says so', () => {
    expect(score('/noindex')).toBeLessThan(50);
    expect(capIds('/noindex')).toContain('noindex');
  });

  it('fails a page robots.txt keeps Googlebot from fetching, and says so', () => {
    expect(score('/private/good')).toBeLessThan(50);
    expect(capIds('/private/good')).toContain('robots-disallowed');
  });

  it('fails a page with nothing on it', () => {
    expect(score('/blank')).toBeLessThanOrEqual(40);
  });

  it('does not pass a page with one sentence of content', () => {
    expect(score('/thin')).toBeLessThan(70);
  });

  it('keeps a page without a <title> out of the top two bands', () => {
    expect(score('/untitled')).toBeLessThan(80);
  });

  it('orders the rungs: broken < thin < complete', () => {
    for (const broken of ['/noindex', '/private/good', '/blank']) {
      expect(score(broken)).toBeLessThan(score('/thin'));
    }
    expect(score('/thin')).toBeLessThan(score('/good'));
    expect(score('/untitled')).toBeLessThan(score('/good'));
  });

  it('moves the overall score only, and records the average it overrode', () => {
    // Category scores still describe what was measured; the cap sits on top.
    const noindex = results.get('/noindex')!;
    expect(noindex.scoreCap?.uncappedScore).toBe(calculateOverallScore(noindex.categoryResults, categories));
  });
});
