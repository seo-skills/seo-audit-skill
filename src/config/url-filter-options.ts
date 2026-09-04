import type { CrawlerConfig } from './schema.js';

/**
 * The URL-filter options a `[crawler]` section describes.
 *
 * `Crawler` has accepted a `urlFilter` since it was written and nothing ever
 * passed one, so `include`, `exclude`, `allow_query_params` and
 * `drop_query_prefixes` did nothing at all. `init --preset ecommerce` writes
 * `exclude = ["/cart/**", "/checkout/**", "/account/**"]`, and a crawl walked
 * straight into all three.
 *
 * The default `drop_query_prefixes` — `utm_`, `gclid`, `fbclid`, `mc_`, `_ga` —
 * was equally inert, so a link with a tracking parameter counted as a separate
 * page and spent the page budget twice on one document.
 *
 * One builder rather than three call sites, because three copies of this
 * mapping is how a fourth key gets forgotten.
 */
export function toUrlFilterOptions(crawler: CrawlerConfig): {
  include: string[];
  exclude: string[];
  allowQueryParams: string[];
  dropQueryPrefixes: string[];
} {
  return {
    include: crawler.include,
    exclude: crawler.exclude,
    allowQueryParams: crawler.allow_query_params,
    dropQueryPrefixes: crawler.drop_query_prefixes,
  };
}
