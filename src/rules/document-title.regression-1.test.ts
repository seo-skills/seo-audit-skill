// Regression: ISSUE-002 — inline SVG <title> elements were read as the document title
// Found by /qa on 2026-10-15
// Report: .gstack/qa-reports/run-20261015T075717Z/qa-report-developer-mozilla-org-2026-10-15.md
//
// developer.mozilla.org has one <title> in <head> and three more inside its
// inline SVG logos. htmlval-multiple-titles failed on "4 <title> elements",
// htmlval-title-outside-head failed on 3 "outside <head>", and rules that read
// `$('title').text()` compared "… | MDNMDNMDNMozilla" against the H1.
import { describe, it, expect } from 'vitest';
import * as cheerio from 'cheerio';
import { createTestContext } from './test-context.js';
import { multipleTitlesRule } from './htmlval/multiple-titles.js';
import { titleOutsideHeadRule } from './htmlval/title-outside-head.js';
import { titlePresentRule } from './core/title-present.js';
import { titleSameAsH1Rule } from './content/title-same-as-h1.js';
import { titlePixelWidthRule } from './content/title-pixel-width.js';
import { renderedTitleRule } from './js/rendered-title.js';
import { buildPageSnapshot } from '../page-snapshot.js';

const LOGO = '<svg viewBox="0 0 10 10"><title>MDN</title><path d="M0 0h10"/></svg>';
const HTML = `<html><head><title>HTML: HyperText Markup Language</title></head>
<body><nav><a href="/">${LOGO}</a></nav>
<h1>HTML: HyperText Markup Language</h1><p>Body.</p>
<footer><a href="https://www.mozilla.org">${LOGO.replace('MDN', 'Mozilla')}</a></footer></body></html>`;

describe('SVG <title> is not the document title (ISSUE-002)', () => {
  const context = () => createTestContext(HTML);

  it('htmlval-multiple-titles counts one document title', async () => {
    const result = await multipleTitlesRule.run(context());
    expect(result.status).toBe('pass');
    expect(result.details?.count).toBe(1);
  });

  it('htmlval-title-outside-head ignores SVG titles', async () => {
    expect((await titleOutsideHeadRule.run(context())).status).toBe('pass');
  });

  it('htmlval-title-outside-head still catches a document title placed in <body>', async () => {
    const html = `<html><head></head><body>${LOGO}<title>Stray</title></body></html>`;
    const result = await titleOutsideHeadRule.run(createTestContext(html));
    expect(result.status).toBe('fail');
    expect(result.details?.titles).toEqual(['Stray']);
  });

  it('content-title-same-as-h1 compares the real title, not one joined with SVG titles', async () => {
    const result = await titleSameAsH1Rule.run(context());
    expect(result.status).not.toBe('pass');
  });

  it('content-title-pixel-width measures the real title only', async () => {
    const result = await titlePixelWidthRule.run(context());
    expect(String(result.details?.title ?? '')).toBe('HTML: HyperText Markup Language');
  });

  it('js-rendered-title reads the rendered document title', async () => {
    const result = await renderedTitleRule.run(
      createTestContext(HTML, { rendered$: cheerio.load(HTML) })
    );
    expect(result.details?.renderedTitle).toBe('HTML: HyperText Markup Language');
  });

  it('core-title-present fails a page whose only <title> belongs to an SVG', async () => {
    const html = `<html><head></head><body>${LOGO}<p>No title.</p></body></html>`;
    expect((await titlePresentRule.run(createTestContext(html))).status).toBe('fail');
  });

  it('the page snapshot does not take an SVG title as the page title', () => {
    const html = `<html><head></head><body>${LOGO}</body></html>`;
    expect(buildPageSnapshot(createTestContext(html)).title).toBeUndefined();
  });
});
