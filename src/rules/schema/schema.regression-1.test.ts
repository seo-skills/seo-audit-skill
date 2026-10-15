// Regression: ISSUE-008 — schema-breadcrumb ignored RDFa and microdata breadcrumbs
// Found by /qa on 2026-10-15
// Report: .gstack/qa-reports/run-20261015T075717Z/qa-report-developer-mozilla-org-2026-10-15.md
//
// developer.mozilla.org marks its breadcrumbs up as an RDFa BreadcrumbList,
// following Google's own RDFa example. schema-breadcrumb read JSON-LD only, so
// it warned "Non-homepage missing BreadcrumbList schema" on every crawled page
// while schema-present, on the same page, reported the RDFa.
import { describe, it, expect } from 'vitest';
import { createTestContext } from '../test-context.js';
import { structuredDataBreadcrumbRule } from './breadcrumb.js';

const URL = 'https://developer.mozilla.org/en-US/docs/Web/HTML';

function rdfa(items: string[]): string {
  const lis = items
    .map(
      (name, i) => `<li property="itemListElement" typeof="ListItem">
        <a property="item" typeof="WebPage" href="/${name}"><span property="name">${name}</span></a>
        <meta property="position" content="${i + 1}"></li>`
    )
    .join('');
  return `<html><head></head><body><ol vocab="https://schema.org/" typeof="BreadcrumbList">${lis}</ol></body></html>`;
}

describe('schema-breadcrumb reads RDFa and microdata (ISSUE-008)', () => {
  it('passes an RDFa BreadcrumbList with two items', async () => {
    const result = await structuredDataBreadcrumbRule.run(
      createTestContext(rdfa(['Web', 'HTML']), { url: URL })
    );
    expect(result.status).toBe('pass');
    expect(result.details?.syntax).toEqual(['RDFa']);
  });

  it('passes a microdata BreadcrumbList with two items', async () => {
    const html = `<html><head></head><body>
      <ol itemscope itemtype="https://schema.org/BreadcrumbList">
        <li itemprop="itemListElement" itemscope itemtype="https://schema.org/ListItem"><span itemprop="name">Web</span></li>
        <li itemprop="itemListElement" itemscope itemtype="https://schema.org/ListItem"><span itemprop="name">HTML</span></li>
      </ol></body></html>`;
    const result = await structuredDataBreadcrumbRule.run(createTestContext(html, { url: URL }));
    expect(result.status).toBe('pass');
  });

  it('applies the two-item minimum to RDFa as well', async () => {
    const result = await structuredDataBreadcrumbRule.run(
      createTestContext(rdfa(['Web']), { url: URL })
    );
    expect(result.status).toBe('warn');
    expect(result.message).toMatch(/at least 2 items/);
  });

  it('still warns when no syntax declares a breadcrumb', async () => {
    const result = await structuredDataBreadcrumbRule.run(
      createTestContext('<html><head></head><body><ol><li>Web</li></ol></body></html>', { url: URL })
    );
    expect(result.status).toBe('warn');
    expect(result.message).toMatch(/missing BreadcrumbList/);
  });
});
