// Fetcher exports
export {
  fetchPage,
  fetchUrl,
  fetchUrlWithRedirects,
  requestSignal,
  unauditableReason,
  createAuditContext,
  type FetchResult,
  type FetchPageOptions,
  type RedirectResult,
} from './fetcher.js';

// Playwright fetcher exports
export {
  initBrowser,
  closeBrowser,
  fetchPageWithPlaywright,
  measureCoreWebVitals,
  getBrowser,
  type PlaywrightFetchResult,
  type RenderOptions,
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

// URL filter exports
export {
  UrlFilter,
  createUrlFilter,
  globToRegex,
  type UrlFilterOptions,
} from './url-filter.js';

// User-Agent exports
export {
  getUserAgent,
  setUserAgent,
  resetUserAgent,
  DEFAULT_USER_AGENT,
} from './user-agent.js';
