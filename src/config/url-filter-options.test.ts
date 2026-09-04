// Regression: ISSUE-011 — the [crawler] URL filter never reached the crawler
// Found by /qa on 2026-09-04
// Report: .gstack/qa-reports/qa-report-cli-config-2026-09-04b.md
//
// `Crawler` has accepted a `urlFilter` option since it was written, uses it in
// `shouldCrawl()` and `normalizeUrl()`, and **nothing ever passed one**. So
// `crawler.include`, `crawler.exclude`, `crawler.allow_query_params` and
// `crawler.drop_query_prefixes` did nothing at all.
//
// `init --preset ecommerce` writes `exclude = ["/cart/**", "/checkout/**",
// "/account/**"]`. Measured against a local site: a crawl with
// `exclude = ["/cart/**"]` visited /cart/c1.html anyway.
//
// The keys are snake_case in TOML and camelCase on `UrlFilterOptions`, which is
// the seam a hand-written mapping gets wrong, so there is one builder and this
// asserts every key survives it.
import { describe, it, expect } from 'vitest';
import { toUrlFilterOptions } from './url-filter-options.js';
import { getDefaultConfig } from './defaults.js';
import { getPresetConfig } from './writer.js';
import { UrlFilter } from '../crawler/url-filter.js';

describe('every [crawler] filter key survives the mapping', () => {
  it('carries all four across the snake_case to camelCase seam', () => {
    const crawler = {
      ...getDefaultConfig().crawler,
      include: ['/products/**'],
      exclude: ['/cart/**'],
      allow_query_params: ['sort'],
      drop_query_prefixes: ['utm_'],
    };

    expect(toUrlFilterOptions(crawler)).toEqual({
      include: ['/products/**'],
      exclude: ['/cart/**'],
      allowQueryParams: ['sort'],
      dropQueryPrefixes: ['utm_'],
    });
  });

  it('maps the ecommerce preset, the one that made this visible', () => {
    const preset = getPresetConfig('ecommerce');
    const crawler = { ...getDefaultConfig().crawler, ...preset.crawler };

    const options = toUrlFilterOptions(crawler);

    expect(options.exclude).toContain('/cart/**');
    expect(options.exclude).toContain('/checkout/**');
    expect(options.allowQueryParams).toContain('sort');
  });
});

describe('the mapped options actually filter', () => {
  /** A filter built the way the audit command builds it. */
  function filterFor(overrides: Partial<ReturnType<typeof getDefaultConfig>['crawler']>) {
    return new UrlFilter(toUrlFilterOptions({ ...getDefaultConfig().crawler, ...overrides }));
  }

  it('excludes what exclude names', () => {
    const filter = filterFor({ exclude: ['/cart/**'] });
    expect(filter.shouldCrawl('https://shop.test/cart/c1.html')).toBe(false);
    expect(filter.shouldCrawl('https://shop.test/products/p1.html')).toBe(true);
  });

  it('keeps only what include names, once include is non-empty', () => {
    const filter = filterFor({ include: ['/products/**'] });
    expect(filter.shouldCrawl('https://shop.test/products/p1.html')).toBe(true);
    expect(filter.shouldCrawl('https://shop.test/cart/c1.html')).toBe(false);
  });

  it('strips the tracking parameters drop_query_prefixes names', () => {
    // Inert, this made one document count as two pages against the budget.
    const filter = filterFor({});
    expect(filter.normalizeUrl('https://shop.test/p?utm_source=ads')).toBe('https://shop.test/p');
    expect(filter.normalizeUrl('https://shop.test/p?gclid=x')).toBe('https://shop.test/p');
  });

  it('keeps a parameter that is not a tracking prefix', () => {
    const filter = filterFor({});
    expect(filter.normalizeUrl('https://shop.test/p?page=2')).toContain('page=2');
  });

  it('honours allow_query_params as a whitelist when set', () => {
    const filter = filterFor({ allow_query_params: ['sort'] });
    expect(filter.normalizeUrl('https://shop.test/p?sort=asc')).toContain('sort=asc');
    expect(filter.normalizeUrl('https://shop.test/p?colour=red')).toBe('https://shop.test/p');
  });

  it('matches the class default when the config is untouched', () => {
    // UrlFilter hardcodes the same tracking-prefix list, so wiring the config
    // must not change what a default run does.
    const configured = filterFor({});
    const bare = new UrlFilter();
    for (const url of [
      'https://shop.test/p?utm_medium=cpc',
      'https://shop.test/p?fbclid=1',
      'https://shop.test/p?page=2',
    ]) {
      expect(configured.normalizeUrl(url)).toBe(bare.normalizeUrl(url));
    }
  });
});
