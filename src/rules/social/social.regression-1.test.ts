// Regression: ISSUE-001 — Open Graph tags declared with name= were reported as missing
// Found by /qa on 2026-10-15
// Report: .gstack/qa-reports/run-20261015T075717Z/qa-report-developer-mozilla-org-2026-10-15.md
//
// developer.mozilla.org writes every Open Graph tag as <meta name="og:title">.
// The protocol (ogp.me) specifies property=, but the tags are there and the
// major unfurlers read them. Six social rules failed with "No <meta
// property="og:title"> tag found in the document", which was false, and the
// report's social card came out empty.
import { describe, it, expect } from 'vitest';
import { createTestContext } from '../test-context.js';
import { ogTitleRule } from './og-title.js';
import { ogDescriptionRule } from './og-description.js';
import { ogImageRule } from './og-image.js';
import { ogImageSizeRule } from './og-image-size.js';
import { ogUrlRule } from './og-url.js';
import { ogUrlCanonicalRule } from './og-url-canonical.js';
import { buildPageSnapshot } from '../../page-snapshot.js';

const PAGE = 'https://developer.mozilla.org/en-US/docs/Web/HTML';

const NAME_ATTRIBUTE_HEAD = `<html><head>
  <title>HTML: HyperText Markup Language | MDN</title>
  <link rel="canonical" href="${PAGE}">
  <meta name="og:url" content="${PAGE}">
  <meta name="og:title" content="HTML: HyperText Markup Language | MDN">
  <meta name="og:description" content="HTML is the most basic building block of the Web.">
  <meta name="og:image" content="https://developer.mozilla.org/mdn-social-image.png">
  <meta name="og:image:width" content="1200">
  <meta name="og:image:height" content="630">
  <meta name="og:site_name" content="MDN Web Docs">
</head><body></body></html>`;

describe('Open Graph tags declared with name= (ISSUE-001)', () => {
  const context = () => createTestContext(NAME_ATTRIBUTE_HEAD, { url: PAGE });

  it.each([
    ['social-og-title', ogTitleRule],
    ['social-og-description', ogDescriptionRule],
    ['social-og-image', ogImageRule],
    ['social-og-url', ogUrlRule],
  ])('%s finds the tag and warns about the attribute instead of failing', async (_id, rule) => {
    const result = await rule.run(context());
    expect(result.status).toBe('warn');
    expect(result.message).not.toMatch(/No <meta/);
    expect(result.message).toMatch(/name=/);
    expect(result.details?.attribute).toBe('name');
  });

  it('social-og-image-size reads the dimensions whichever attribute declares them', async () => {
    const result = await ogImageSizeRule.run(context());
    expect(result.status).toBe('pass');
  });

  it('social-og-url-canonical compares the name= og:url against the canonical', async () => {
    const result = await ogUrlCanonicalRule.run(context());
    expect(result.status).toBe('pass');
  });

  it('the page snapshot carries the Open Graph card for the report', () => {
    const snapshot = buildPageSnapshot(context());
    expect(snapshot.og.title).toBe('HTML: HyperText Markup Language | MDN');
    expect(snapshot.og.image).toBe('https://developer.mozilla.org/mdn-social-image.png');
    expect(snapshot.og.siteName).toBe('MDN Web Docs');
  });

  it('property= still passes, and wins when both attributes are present', async () => {
    const html = `<html><head>
      <meta property="og:title" content="From property">
      <meta name="og:title" content="From name">
    </head><body></body></html>`;
    const result = await ogTitleRule.run(createTestContext(html));
    expect(result.status).toBe('pass');
    expect(result.details?.ogTitle).toBe('From property');
  });

  it('a page with neither attribute still fails', async () => {
    const result = await ogTitleRule.run(createTestContext('<html><head></head></html>'));
    expect(result.status).toBe('fail');
  });
});
