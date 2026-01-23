import { chromium, type Browser, type Page } from 'playwright';
import type { CoreWebVitals } from '../types.js';

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
  const page = await browser.newPage();

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
    };
  } finally {
    await page.close();
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
      try {
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          if (lastEntry) {
            lcpValue = Math.round(lastEntry.startTime);
          }
        });
        lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });

        // Give it a moment to collect entries
        setTimeout(() => {
          lcpObserver.disconnect();
        }, 100);
      } catch {
        // LCP observer not supported
      }

      // Use PerformanceObserver for CLS
      let clsValue = 0;
      try {
        const clsObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            // @ts-expect-error - LayoutShift type not in standard types
            if (!entry.hadRecentInput) {
              // @ts-expect-error - LayoutShift type not in standard types
              clsValue += entry.value;
            }
          }
        });
        clsObserver.observe({ type: 'layout-shift', buffered: true });

        setTimeout(() => {
          clsObserver.disconnect();
        }, 100);
      } catch {
        // CLS observer not supported
      }

      // Wait for observers to collect data
      setTimeout(() => {
        if (lcpValue !== undefined) {
          metrics.lcp = lcpValue;
        }
        if (clsValue > 0) {
          metrics.cls = Math.round(clsValue * 1000) / 1000; // Round to 3 decimal places
        }
        resolve(metrics);
      }, 200);
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
