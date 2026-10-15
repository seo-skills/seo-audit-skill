// Regression: ISSUE-026 — Open Graph <meta property> tags were read as RDFa structured data
// Found by /qa on 2026-10-15
// Report: .gstack/qa-reports/run-20261015T102121Z/qa-report-seomator-cli-skill-2026-10-15.md
//
// schema-present (weight 25) counted any [property] attribute as RDFa, so a
// page with ordinary Open Graph tags and no structured data at all was told
// "Structured data found (RDFa)" and warned instead of failing. Since
// schema-valid, -type and -required-fields report not measured when there is
// no JSON-LD ("schema-present reports its absence"), such a page lost most of
// its schema penalty. Two otherwise identical fixtures, one writing OG with
// property= and one with name=, got opposite verdicts.
import { describe, it, expect } from 'vitest';
import { createTestContext } from '../test-context.js';
import { structuredDataPresentRule } from './present.js';

const OG = `<meta property="og:title" content="T"><meta property="og:image" content="https://x.test/i.png">
<meta property="article:published_time" content="2026-10-15">`;

describe('schema-present and RDFa (ISSUE-026)', () => {
  it('fails a page whose only property= attributes are Open Graph tags', async () => {
    const html = `<html><head>${OG}</head><body><p>No structured data here.</p></body></html>`;
    const result = await structuredDataPresentRule.run(createTestContext(html));
    expect(result.status).toBe('fail');
  });

  it('still recognises RDFa structured data, which declares a type', async () => {
    const html = `<html><head>${OG}</head><body>
      <ol vocab="https://schema.org/" typeof="BreadcrumbList">
        <li property="itemListElement" typeof="ListItem"><span property="name">Docs</span></li>
      </ol></body></html>`;
    const result = await structuredDataPresentRule.run(createTestContext(html));
    expect(result.status).toBe('warn');
    expect(result.message).toMatch(/RDFa/);
  });

  it('keeps JSON-LD and microdata verdicts unchanged', async () => {
    const jsonLd = `<html><head>${OG}<script type="application/ld+json">{"@type":"WebPage"}</script></head><body></body></html>`;
    expect((await structuredDataPresentRule.run(createTestContext(jsonLd))).status).toBe('pass');
    const microdata = `<html><body><div itemscope itemtype="https://schema.org/Product"><span itemprop="name">W</span></div></body></html>`;
    expect((await structuredDataPresentRule.run(createTestContext(microdata))).status).toBe('warn');
  });
});
