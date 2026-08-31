import { chromium, type Browser, type Page } from 'playwright';
import type { CoreWebVitals, FailedRequestInfo, RenderDiagnostics } from '../types.js';
import { getUserAgent } from './user-agent.js';

let browserPromise: Promise<Browser> | null = null;

/**
 * Try to launch browser with given options
 */
async function tryLaunch(options: Parameters<typeof chromium.launch>[0]): Promise<Browser> {
  return chromium.launch(options);
}

/**
 * Initialize the Chromium browser for Playwright operations
 * Uses Promise-based singleton pattern to prevent race conditions
 * Tries system Chrome first, then falls back to Playwright's bundled browser
 * @returns Promise that resolves to the Browser instance
 */
export async function initBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = (async () => {
      const baseArgs = [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
      ];

      // Try system Chrome first (no download needed)
      const channels = ['chrome', 'chromium', 'msedge'] as const;
      for (const channel of channels) {
        try {
          return await tryLaunch({
            channel,
            headless: true,
            args: baseArgs,
          });
        } catch {
          // Channel not available, try next
        }
      }

      // Fall back to Playwright's bundled Chromium
      return await tryLaunch({
        headless: true,
        args: baseArgs,
      });
    })();
  }
  return browserPromise;
}

/**
 * Close the browser instance
 * @returns Promise that resolves when browser is closed
 */
export async function closeBrowser(): Promise<void> {
  if (browserPromise) {
    const browser = await browserPromise;
    await browser.close();
    browserPromise = null;
  }
}

/**
 * Result of fetching a page with Playwright
 */
export interface PlaywrightFetchResult {
  /** Raw HTML content after JS execution */
  html: string;
  /** HTTP status code */
  statusCode: number;
  /** Response time in milliseconds (until load event) */
  responseTime: number;
  /** Core Web Vitals metrics */
  cwv: CoreWebVitals;
  /** Errors and failed requests observed during the render */
  diagnostics: RenderDiagnostics;
}

/**
 * Caps on collected diagnostics.
 *
 * A page stuck in an error loop can emit thousands of identical console
 * messages; the rules only need enough to characterise the problem, and the
 * arrays travel into stored audits and reports.
 */
const MAX_PAGE_ERRORS = 25;
const MAX_CONSOLE_MESSAGES = 50;
const MAX_FAILED_REQUESTS = 50;

/**
 * Attach diagnostic listeners to a page before navigation.
 *
 * Must run before `page.goto`, since errors thrown during initial parse and
 * requests issued during load are only observable from that point on.
 *
 * @param page - The page about to be navigated
 * @returns The collector that fills as the page loads
 */
function collectDiagnostics(page: Page): RenderDiagnostics {
  const diagnostics: RenderDiagnostics = {
    pageErrors: [],
    consoleMessages: [],
    failedRequests: [],
  };

  /**
   * One broken resource surfaces on both listeners: a 404 script arrives as a
   * `response` with status 404 and then as a `requestfailed` with
   * `net::ERR_ABORTED`. Keyed by URL so it is reported once, and the HTTP
   * status wins because it says what actually happened.
   */
  const failuresByUrl = new Map<string, FailedRequestInfo>();
  const recordFailure = (info: FailedRequestInfo, authoritative: boolean): void => {
    const existing = failuresByUrl.get(info.url);
    if (existing && !authoritative) return;
    if (!existing && failuresByUrl.size >= MAX_FAILED_REQUESTS) return;
    failuresByUrl.set(info.url, existing && authoritative ? { ...existing, ...info } : info);
    diagnostics.failedRequests = Array.from(failuresByUrl.values());
  };

  page.on('pageerror', (error) => {
    if (diagnostics.pageErrors.length >= MAX_PAGE_ERRORS) return;
    diagnostics.pageErrors.push(error.message);
  });

  page.on('console', (message) => {
    const type = message.type();
    if (type !== 'error' && type !== 'warning') return;
    if (diagnostics.consoleMessages.length >= MAX_CONSOLE_MESSAGES) return;

    const location = message.location();
    diagnostics.consoleMessages.push({
      level: type,
      text: message.text().slice(0, 500),
      ...(location.url && { sourceUrl: location.url }),
      ...(location.lineNumber !== undefined && { line: location.lineNumber }),
    });
  });

  // Network-level failures: DNS, connection refused, blocked by the client.
  page.on('requestfailed', (request) => {
    recordFailure(
      {
        url: request.url(),
        resourceType: request.resourceType(),
        method: request.method(),
        failure: request.failure()?.errorText ?? 'Request failed',
      },
      false
    );
  });

  // Requests that completed with an error status. A 404 script is not a
  // `requestfailed` as far as the browser is concerned, but it is just as
  // broken for the page.
  page.on('response', (response) => {
    const status = response.status();
    if (status < 400) return;
    // The main document's own status is reported separately as statusCode.
    if (response.request().resourceType() === 'document') return;

    recordFailure(
      {
        url: response.url(),
        resourceType: response.request().resourceType(),
        method: response.request().method(),
        failure: `HTTP ${status}`,
        statusCode: status,
      },
      true
    );
  });

  return diagnostics;
}

/**
 * Fetch a page with full browser rendering and JavaScript execution
 * @param url - URL to fetch
 * @param timeout - Navigation timeout in milliseconds (default: 30000)
 * @returns PlaywrightFetchResult with html, statusCode, responseTime, cwv
 */
export async function fetchPageWithPlaywright(
  url: string,
  timeout = 30000
): Promise<PlaywrightFetchResult> {
  const browser = await initBrowser();
  // A context, not a bare page, so the render identifies itself with the same
  // User-Agent as the HTTP crawler instead of the default headless Chrome one.
  const context = await browser.newContext({ userAgent: getUserAgent() });
  const page = await context.newPage();
  // Listeners must be attached before goto to see load-time errors.
  const diagnostics = collectDiagnostics(page);

  try {
    const startTime = performance.now();

    // Navigate and wait for load
    const response = await page.goto(url, {
      waitUntil: 'load',
      timeout,
    });

    const loadTime = performance.now() - startTime;

    // Wait a bit more for any dynamic content
    await page.waitForTimeout(1000);

    // Get HTML content after JS execution
    const html = await page.content();

    // Measure Core Web Vitals
    const cwv = await measureCoreWebVitals(page);

    return {
      html,
      statusCode: response?.status() ?? 0,
      responseTime: Math.round(loadTime),
      cwv,
      diagnostics,
    };
  } finally {
    await page.close();
    await context.close();
  }
}

/**
 * Measure Core Web Vitals using PerformanceObserver injection
 * @param page - Playwright Page instance
 * @returns CoreWebVitals metrics
 */
export async function measureCoreWebVitals(page: Page): Promise<CoreWebVitals> {
  const cwv = await page.evaluate(() => {
    return new Promise<CoreWebVitals>((resolve) => {
      const metrics: CoreWebVitals = {};

      // Get TTFB from Navigation Timing API
      const navEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
      if (navEntry) {
        metrics.ttfb = Math.round(navEntry.responseStart - navEntry.requestStart);
      }

      // Get FCP from Paint Timing API
      const paintEntries = performance.getEntriesByType('paint');
      for (const entry of paintEntries) {
        if (entry.name === 'first-contentful-paint') {
          metrics.fcp = Math.round(entry.startTime);
        }
      }

      // Use PerformanceObserver for LCP
      let lcpValue: number | undefined;
      let lcpObserver: PerformanceObserver | undefined;
      try {
        lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          if (lastEntry) {
            lcpValue = Math.round(lastEntry.startTime);
          }
        });
        lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
      } catch {
        // LCP observer not supported
      }

      // Use PerformanceObserver for CLS
      let clsValue = 0;
      let clsObserver: PerformanceObserver | undefined;
      try {
        clsObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            // @ts-expect-error - LayoutShift type not in standard types
            if (!entry.hadRecentInput) {
              // @ts-expect-error - LayoutShift type not in standard types
              clsValue += entry.value;
            }
          }
        });
        clsObserver.observe({ type: 'layout-shift', buffered: true });
      } catch {
        // CLS observer not supported
      }

      // Wait longer for metrics to be collected (LCP can take time)
      setTimeout(() => {
        // Disconnect observers
        lcpObserver?.disconnect();
        clsObserver?.disconnect();

        // Set LCP if collected
        if (lcpValue !== undefined) {
          metrics.lcp = lcpValue;
        }

        // CLS of 0 is valid (no layout shifts is good)
        metrics.cls = Math.round(clsValue * 1000) / 1000;

        resolve(metrics);
      }, 1000); // Wait 1 second for metrics collection
    });
  });

  return cwv;
}

/**
 * Get the current browser instance (for advanced usage)
 * @returns Promise resolving to Browser instance, or null if not initialized
 */
export async function getBrowser(): Promise<Browser | null> {
  return browserPromise ? browserPromise : null;
}
