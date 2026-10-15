// Regression: ISSUE-011 — cross-page rules passed a single-page audit they could not measure
// Found by /qa on 2026-10-15
// Report: .gstack/qa-reports/run-20261015T075717Z/qa-report-developer-mozilla-org-2026-10-15.md
//
// A single-page audit of developer.mozilla.org reported "Page title is
// unique", "Meta description is unique" and "Content is unique": each rule's
// registry held only this page, so it compared against nothing.
// crawl-sitemap-orphan-urls went the other way, counting this page's link
// targets as "crawled pages" and warning that 99.3% of 49,999 sitemap URLs
// were orphans. content-duplicate-h1 and content-title-pattern already report
// not measured without a crawl; these five now do too.
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestContext } from './test-context.js';
import { resetCrossPageState } from './registry.js';
import { titleUniqueRule } from './core/title-unique.js';
import { duplicateDescriptionRule } from './content/duplicate-description.js';
import { duplicateExactRule } from './content/duplicate-exact.js';
import { duplicateNearRule } from './content/duplicate-near.js';
import { sitemapOrphanUrlsRule } from './crawl/sitemap-orphan-urls.js';
import type { AuditContext, SiteContext } from '../types.js';

const PAGE = `<html><head><title>Shared title for the page</title>
<meta name="description" content="A description long enough to be compared with the other pages."></head>
<body><main><p>${'Body copy that repeats across the two pages so they match exactly. '.repeat(20)}</p></main></body></html>`;

const SITE = { pageCount: 2, normalize: (url: string) => url } as unknown as SiteContext;

function single(url = 'https://example.com/a'): AuditContext {
  return createTestContext(PAGE, {
    url,
    links: [{ href: 'https://example.com/b', text: 'b', isInternal: true, isNoFollow: false }],
    sitemapUrls: ['https://example.com/a', 'https://example.com/c'],
  });
}

describe('cross-page rules without a crawl (ISSUE-011)', () => {
  beforeEach(() => resetCrossPageState());

  it.each([
    ['core-title-unique', titleUniqueRule],
    ['content-duplicate-description', duplicateDescriptionRule],
    ['content-duplicate-exact', duplicateExactRule],
    ['content-duplicate-near', duplicateNearRule],
    ['crawl-sitemap-orphan-urls', sitemapOrphanUrlsRule],
  ])('%s is not measured on a single page', async (_id, rule) => {
    expect((await rule.run(single())).status).toBe('not-measured');
  });

  it.each([
    ['core-title-unique', titleUniqueRule],
    ['content-duplicate-description', duplicateDescriptionRule],
    ['content-duplicate-exact', duplicateExactRule],
  ])('%s still compares pages in a crawl', async (_id, rule) => {
    await rule.run({ ...single('https://example.com/a'), site: SITE });
    const second = await rule.run({ ...single('https://example.com/b'), site: SITE });
    expect(['warn', 'fail']).toContain(second.status);
  });
});
