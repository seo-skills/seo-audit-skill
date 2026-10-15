// Regression: `analyze` must cap a replayed crawl the way `audit --crawl` does
// Found on 2026-10-15 while capping crawls by their start page
//
// `analyze` builds its own result from a stored crawl rather than going
// through `auditWithCrawl`, so it would have skipped the start-page cap and
// scored a site that is noindex everywhere 92 where `audit --crawl` scores it
// 20. The start page is the first stored page: `crawl` records depth 0 for
// every page, so depth cannot identify it, but the crawler records the entry
// before it queues a single link.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./analyze.ts', import.meta.url).pathname, 'utf8');

describe('analyze caps a crawl by its start page', () => {
  it('reads the facts from the first stored page', () => {
    expect(source).toMatch(/const start = pages\[0\];/);
    expect(source).toMatch(/siteCaps\(readPageFacts\(start\.context\), start\.url, \{ staging: options\.staging \}\)/);
  });

  it('skips a start page whose context could not be rebuilt', () => {
    expect(source).toMatch(/start && !start\.error/);
  });

  it('records staging on the stored run, as audit does', () => {
    expect(source).toMatch(/\.\.\.\(options\.staging && \{ staging: true \}\)/);
  });
});
