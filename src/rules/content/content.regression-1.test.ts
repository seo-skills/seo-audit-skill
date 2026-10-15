// Regression: ISSUE-003 — structured-data <meta> in <body> was reported as misplaced
// Found by /qa on 2026-10-15
// Report: .gstack/qa-reports/run-20261015T075717Z/qa-report-developer-mozilla-org-2026-10-15.md
//
// developer.mozilla.org marks its breadcrumbs up as an RDFa BreadcrumbList,
// with <meta property="position" content="1"> inside each <li>. HTML+RDFa
// permits that, as microdata permits <meta itemprop> in flow content: the
// element carries data for the item around it, not for the document.
// content-meta-in-body failed the page on them and printed the property
// attribute as name="position".
import { describe, it, expect } from 'vitest';
import { createTestContext } from '../test-context.js';
import { metaInBodyRule } from './meta-in-body.js';

describe('content-meta-in-body and structured data (ISSUE-003)', () => {
  it('passes RDFa metadata inside a typeof scope', async () => {
    const html = `<html><head><title>T</title></head><body>
      <ol vocab="https://schema.org/" typeof="BreadcrumbList">
        <li property="itemListElement" typeof="ListItem">
          <a property="item" typeof="WebPage" href="/docs"><span property="name">Docs</span></a>
          <meta property="position" content="1">
        </li>
      </ol></body></html>`;
    expect((await metaInBodyRule.run(createTestContext(html))).status).toBe('pass');
  });

  it('passes microdata metadata', async () => {
    const html = `<html><head><title>T</title></head><body>
      <div itemscope itemtype="https://schema.org/Product">
        <meta itemprop="sku" content="A-1"><span itemprop="name">Widget</span>
      </div></body></html>`;
    expect((await metaInBodyRule.run(createTestContext(html))).status).toBe('pass');
  });

  it('still fails a head tag that ended up in <body>, and labels it by its attribute', async () => {
    const html = `<html><head><title>T</title></head><body>
      <meta property="og:title" content="Lost"><meta name="description" content="Lost too">
      </body></html>`;
    const result = await metaInBodyRule.run(createTestContext(html));
    expect(result.status).toBe('fail');
    const tags = (result.details?.issues as { tag: string }[]).map((issue) => issue.tag);
    expect(tags).toEqual(['<meta property="og:title">', '<meta name="description">']);
  });
});
