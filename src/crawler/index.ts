// Fetcher exports
export {
  fetchPage,
  fetchUrl,
  createAuditContext,
  type FetchResult,
} from './fetcher.js';

// Playwright fetcher exports
export {
  initBrowser,
  closeBrowser,
  fetchPageWithPlaywright,
  measureCoreWebVitals,
  getBrowser,
  type PlaywrightFetchResult,
} from './playwright-fetcher.js';

// Crawler exports
export {
  Crawler,
  createCrawler,
  type CrawlProgressCallback,
  type CrawlProgress,
  type CrawlerOptions,
  type CrawledPage,
} from './crawler.js';
