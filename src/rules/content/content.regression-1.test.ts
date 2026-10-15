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
import { brokenHtmlRule } from './broken-html.js';
import { mimeTypeRule } from './mime-type.js';

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

// Regression: ISSUE-007 — content-broken-html called labelled buttons empty
// Found by /qa on 2026-10-15
// Report: .gstack/qa-reports/run-20261015T075717Z/qa-report-developer-mozilla-org-2026-10-15.md
//
// developer.mozilla.org's sidebar toggle, survey and clear-filter buttons are
// named through aria-labelledby. content-broken-html's empty-button check
// read only text, aria-label and title, so it failed the page on 4 "empty
// buttons" that a11y-button-name, on the same page, passed.
describe('content-broken-html empty-button check (ISSUE-007)', () => {
  it('accepts buttons named by aria-labelledby or an image alt', async () => {
    const html = `<html><head><title>T</title></head><body>
      <span id="toggle-label" hidden>Toggle sidebar</span>
      <button aria-labelledby="toggle-label"><svg></svg></button>
      <button><img src="x.png" alt="Search"></button>
    </body></html>`;
    const result = await brokenHtmlRule.run(createTestContext(html));
    const buttons = ((result.details?.issues ?? []) as { element: string }[]).filter(
      (issue) => issue.element === '<button>'
    );
    expect(buttons).toEqual([]);
  });

  it('still reports a button with no name at all', async () => {
    const html = '<html><head><title>T</title></head><body><button><svg></svg></button></body></html>';
    const result = await brokenHtmlRule.run(createTestContext(html));
    const buttons = ((result.details?.issues ?? []) as { element: string }[]).filter(
      (issue) => issue.element === '<button>'
    );
    expect(buttons).toHaveLength(1);
  });
});

// Regression: ISSUE-012 — content-mime-type ignored a <meta charset> the browser reads
// Found by /qa on 2026-10-15
// Report: .gstack/qa-reports/run-20261015T075717Z/qa-report-developer-mozilla-org-2026-10-15.md
//
// developer.mozilla.org sends "content-type: text/html" and declares
// <meta charset="UTF-8"> at byte 167. The HTML encoding sniffing algorithm
// reads a <meta charset> within the first 1,024 bytes, so the encoding is
// unambiguous, but the rule warned that the charset was missing.
describe('content-mime-type and <meta charset> (ISSUE-012)', () => {
  const page = (head: string) => `<!doctype html><html><head>${head}<title>T</title></head><body></body></html>`;
  const headers = { 'content-type': 'text/html' };

  it('passes a UTF-8 <meta charset> inside the first 1,024 bytes', async () => {
    const html = page('<meta charset="UTF-8">');
    const result = await mimeTypeRule.run(createTestContext(html, { headers }));
    expect(result.status).toBe('pass');
    expect(result.details?.charsetSource).toBe('meta');
  });

  it('reads the http-equiv form too', async () => {
    const html = page('<meta http-equiv="Content-Type" content="text/html; charset=utf-8">');
    expect((await mimeTypeRule.run(createTestContext(html, { headers }))).status).toBe('pass');
  });

  it('still warns when the declaration comes too late for the browser to use', async () => {
    const html = page(`<!-- ${'x'.repeat(1100)} --><meta charset="UTF-8">`);
    expect((await mimeTypeRule.run(createTestContext(html, { headers }))).status).toBe('warn');
  });

  it('still warns when no charset is declared anywhere', async () => {
    expect((await mimeTypeRule.run(createTestContext(page(''), { headers }))).status).toBe('warn');
  });
});
