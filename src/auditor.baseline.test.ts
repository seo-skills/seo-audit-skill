/**
 * Scoring baseline.
 *
 * Pins the exact scores and counts a fixed page produces through every
 * category with the network stubbed. It exists so engine plumbing changes
 * (cancellation, progress, injection seams) can prove they did not move a
 * single number. If a rule change moves these on purpose, update the
 * expected values in the same commit and say why.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Auditor } from './auditor.js';
import { isNotMeasured } from './rules/define-rule.js';

export const BASELINE_URL = 'https://baseline.test/';

export const BASELINE_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Baseline Fixture — a page for pinning scores</title>
  <meta name="description" content="A fixture page with enough structure to exercise most rules: links, images, structured data and social tags.">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="canonical" href="${BASELINE_URL}">
  <meta property="og:title" content="Baseline Fixture">
  <meta property="og:description" content="Fixture page for the scoring baseline.">
  <meta property="og:image" content="${BASELINE_URL}og.png">
  <meta name="twitter:card" content="summary_large_image">
  <script type="application/ld+json">{"@context":"https://schema.org","@type":"WebPage","name":"Baseline Fixture","url":"${BASELINE_URL}"}</script>
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  <header><nav><a href="/">Home</a> <a href="/about">About</a> <a href="/contact">Contact</a></nav></header>
  <main>
    <h1>Baseline Fixture</h1>
    <p>This page exists to pin the audit engine's scoring. It has a few paragraphs of ordinary prose so the content rules have something to measure, a couple of images, an internal link or two and one external link.</p>
    <h2>Section one</h2>
    <p>More prose here. Nothing on this page changes between runs, and the network is stubbed, so every number the audit produces is a function of the engine alone.</p>
    <img src="/hero.jpg" alt="A hero image" width="800" height="400">
    <img src="/decor.png">
    <p>Read the <a href="https://example.org/reference" rel="noopener">reference</a> or go <a href="/about">about</a>.</p>
    <h2>Section two</h2>
    <ul><li>One</li><li>Two</li><li>Three</li></ul>
  </main>
  <footer><a href="/privacy">Privacy</a> © Baseline</footer>
</body>
</html>`;

const ROBOTS = `User-agent: *\nAllow: /\nSitemap: ${BASELINE_URL}sitemap.xml\n`;
const SITEMAP = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${BASELINE_URL}</loc></url><url><loc>${BASELINE_URL}about</loc></url></urlset>`;

/** Deterministic network: the page, its robots.txt and sitemap; everything else 404 */
export function makeBaselineFetch() {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const method = init?.method ?? 'GET';
    const headers = { 'content-type': 'text/html; charset=utf-8', 'x-frame-options': 'DENY' };
    if (url === BASELINE_URL || url === `${BASELINE_URL}about` || url === `${BASELINE_URL}contact`) {
      return new Response(method === 'HEAD' ? null : BASELINE_HTML, { status: 200, headers });
    }
    if (url === `${BASELINE_URL}robots.txt`) {
      return new Response(ROBOTS, { status: 200, headers: { 'content-type': 'text/plain' } });
    }
    if (url === `${BASELINE_URL}sitemap.xml`) {
      return new Response(SITEMAP, { status: 200, headers: { 'content-type': 'application/xml' } });
    }
    return new Response(null, { status: 404 });
  });
}

/** Category id → [score, pass, warn, fail, notMeasured] */
const EXPECTED_CATEGORIES: Record<string, [number, number, number, number, number]> = {
  core: [98, 22, 1, 1, 0],
  technical: [99, 16, 0, 1, 0],
  perf: [89, 13, 5, 0, 8],
  links: [97, 16, 1, 1, 6],
  images: [59, 8, 4, 2, 0],
  security: [75, 12, 6, 3, 2],
  crawl: [99, 19, 1, 0, 15],
  schema: [91, 11, 2, 0, 0],
  a11y: [98, 30, 1, 0, 0],
  content: [95, 17, 0, 1, 1],
  social: [61, 4, 3, 2, 0],
  eeat: [87, 11, 3, 0, 0],
  url: [100, 14, 0, 0, 0],
  mobile: [90, 6, 1, 0, 5],
  i18n: [100, 12, 0, 0, 1],
  legal: [100, 1, 0, 0, 0],
  js: [100, 3, 0, 0, 13],
  redirect: [100, 8, 0, 0, 3],
  htmlval: [100, 11, 0, 0, 0],
  geo: [80, 3, 2, 0, 0],
};
const EXPECTED_OVERALL = 90;

describe('scoring baseline', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', makeBaselineFetch());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('produces the pinned scores for the fixture page', async () => {
    const auditor = new Auditor({ measureCwv: false });
    const result = await auditor.audit(BASELINE_URL);

    const actual: Record<string, [number, number, number, number, number]> = {};
    for (const category of result.categoryResults) {
      actual[category.categoryId] = [
        category.score,
        category.passCount,
        category.warnCount,
        category.failCount,
        category.results.filter(isNotMeasured).length,
      ];
    }

    expect(actual).toEqual(EXPECTED_CATEGORIES);
    expect(result.overallScore).toBe(EXPECTED_OVERALL);
  }, 30_000);
});
