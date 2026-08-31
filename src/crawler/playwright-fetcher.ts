import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { chromium, type Browser, type Page } from 'playwright';
import type { CoreWebVitals, FailedRequestInfo, RenderDiagnostics } from '../types.js';
import { getUserAgent, MOBILE_USER_AGENT } from './user-agent.js';

/**
 * Shape of a `web-vitals` report, narrowed to the fields we read.
 *
 * Declared here rather than imported: the library runs inside the page, so its
 * types are not otherwise in scope for the `page.evaluate` callbacks.
 */
interface WebVitalsMetric {
  name: string;
  value: number;
  attribution?: {
    /** LCP: selector of the element that produced the largest paint */
    element?: string;
    /** CLS: selector of the element behind the single largest shift */
    largestShiftTarget?: string;
  };
}

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
  /**
   * Errors and failed requests observed during the render.
   *
   * Optional so a custom `browserFetcher` need not synthesise diagnostics it
   * cannot produce; absent means "not captured", which rules report as
   * unmeasured rather than as a clean result.
   */
  diagnostics?: RenderDiagnostics;
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

/** Options controlling how a page is rendered */
export interface RenderOptions {
  /**
   * Render at a mobile viewport with a mobile User-Agent instead of desktop.
   * Used for mobile-first parity: comparing what a phone sees against desktop.
   */
  mobile?: boolean;
  /**
   * Perform a synthetic scroll/click/keypress after load so INP can be
   * measured. Off by default: the value reflects an arbitrary element rather
   * than real usage, so it is reported only when explicitly requested.
   */
  simulateInteraction?: boolean;
}

/**
 * A representative modern phone. Chosen over playwright's device registry so
 * the emulation profile is explicit and does not shift with Playwright updates.
 */
const MOBILE_CONTEXT = {
  viewport: { width: 393, height: 852 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
} as const;

/**
 * Source of the `web-vitals` IIFE build, read once per process.
 *
 * The package's `exports` map blocks deep subpath resolution, so the file is
 * located relative to the resolved main entry (both live in `dist/`) rather
 * than by requiring the path directly.
 */
let webVitalsSource: string | null = null;

function getWebVitalsSource(): string {
  if (webVitalsSource === null) {
    const require = createRequire(import.meta.url);
    const distDir = dirname(require.resolve('web-vitals'));
    webVitalsSource = readFileSync(join(distDir, 'web-vitals.attribution.iife.js'), 'utf8');
  }
  return webVitalsSource;
}

/**
 * Install the `web-vitals` collectors before any page script runs.
 *
 * Must be called before `page.goto`: LCP, FCP and layout-shift entries are
 * emitted during the initial load, and a subscriber attached afterwards sees
 * only what the buffer still holds.
 *
 * `reportAllChanges` makes every candidate value arrive as it happens, so the
 * latest reading is always available without waiting for the page-hide that
 * normally finalises LCP, CLS and INP.
 *
 * @param page - The page about to be navigated
 */
async function injectWebVitals(page: Page): Promise<void> {
  // The IIFE declares `webVitals` with `var`; re-exporting it explicitly keeps
  // it reachable regardless of how the runner scopes an init script.
  await page.addInitScript({
    content: `${getWebVitalsSource()}\n;globalThis.__webVitals = webVitals;`,
  });

  await page.addInitScript(() => {
    const wv = (globalThis as unknown as { __webVitals?: Record<string, unknown> }).__webVitals;
    if (!wv) return;

    const collected: Record<string, WebVitalsMetric> = {};
    (window as unknown as { __cwv: Record<string, WebVitalsMetric> }).__cwv = collected;

    const record = (metric: WebVitalsMetric): void => {
      collected[metric.name.toLowerCase()] = metric;
    };
    const options = { reportAllChanges: true };
    const subscribe = wv as Record<string, (cb: (m: WebVitalsMetric) => void, o: unknown) => void>;
    for (const name of ['onLCP', 'onCLS', 'onINP', 'onFCP', 'onTTFB']) {
      try {
        subscribe[name]?.(record, options);
      } catch {
        // A metric unsupported by this browser simply goes unreported.
      }
    }

    // Long tasks feed TBT, which web-vitals does not cover.
    const longTasks: { start: number; duration: number }[] = [];
    (window as unknown as { __longTasks: typeof longTasks }).__longTasks = longTasks;
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          longTasks.push({ start: entry.startTime, duration: entry.duration });
        }
      }).observe({ type: 'longtask', buffered: true });
    } catch {
      // No longtask support; TBT goes unreported.
    }
  });
}

/**
 * Drive one synthetic interaction so INP has something to measure.
 *
 * INP only exists once a real interaction has happened, so an untouched crawl
 * never produces one. The resulting number reflects whichever element the
 * crawler happened to hit, not real usage, which is why it is opt-in and
 * flagged as synthetic in the result.
 *
 * @param page - The loaded page to interact with
 */
async function performSyntheticInteraction(page: Page): Promise<void> {
  // Suppress navigation and form submission before clicking: following a link
  // would tear down the very document being measured. Capture-phase
  // preventDefault leaves the site's own handlers running, so their cost is
  // still what INP records.
  await page.evaluate(() => {
    document.addEventListener('click', (event) => event.preventDefault(), true);
    document.addEventListener('submit', (event) => event.preventDefault(), true);
    window.scrollBy(0, 600);
  });

  const target = page
    .locator('a[href], button, [role="button"], input:not([type="hidden"]), select, textarea')
    .first();
  try {
    await target.click({ timeout: 2000 });
  } catch {
    // Nothing clickable, or it was obscured — a bare keypress still counts.
  }
  await page.keyboard.press('Tab');

  // INP is only reported once the interaction reaches the next paint.
  await page.waitForTimeout(500);
}

/**
 * Fetch a page with full browser rendering and JavaScript execution
 * @param url - URL to fetch
 * @param timeout - Navigation timeout in milliseconds (default: 30000)
 * @param options - Render options (e.g. mobile viewport)
 * @returns PlaywrightFetchResult with html, statusCode, responseTime, cwv
 */
export async function fetchPageWithPlaywright(
  url: string,
  timeout = 30000,
  options: RenderOptions = {}
): Promise<PlaywrightFetchResult> {
  const browser = await initBrowser();
  // A context, not a bare page, so the render identifies itself with the same
  // User-Agent as the HTTP crawler instead of the default headless Chrome one.
  const context = await browser.newContext(
    options.mobile
      ? { userAgent: MOBILE_USER_AGENT, ...MOBILE_CONTEXT }
      : { userAgent: getUserAgent() }
  );
  const page = await context.newPage();
  // Listeners must be attached before goto to see load-time errors.
  const diagnostics = collectDiagnostics(page);
  // Likewise the metric collectors: LCP and layout shifts happen during load.
  await injectWebVitals(page);

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

    // INP has no value without an interaction, so produce one on request.
    if (options.simulateInteraction) {
      await performSyntheticInteraction(page);
    }

    // Measure Core Web Vitals
    const cwv = await measureCoreWebVitals(page);
    if (options.simulateInteraction && cwv.inp !== undefined) {
      cwv.inpSynthetic = true;
    }

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
 * Read the metrics collected by the injected `web-vitals` subscribers.
 *
 * Requires {@link injectWebVitals} to have run before navigation; without it
 * there is nothing to read and this returns an empty result, which rules report
 * as unmeasured rather than as a clean score.
 *
 * @param page - Playwright Page instance, already navigated and settled
 * @returns CoreWebVitals metrics
 */
export async function measureCoreWebVitals(page: Page): Promise<CoreWebVitals> {
  return page.evaluate(() => {
    const collected = (window as unknown as { __cwv?: Record<string, WebVitalsMetric> }).__cwv;
    if (!collected) return {};

    const metrics: CoreWebVitals = {};
    const round = (value: number): number => Math.round(value);

    if (collected.lcp) {
      metrics.lcp = round(collected.lcp.value);
      const element = collected.lcp.attribution?.element;
      if (element) metrics.lcpElement = element;
    }
    if (collected.fcp) metrics.fcp = round(collected.fcp.value);
    if (collected.ttfb) metrics.ttfb = round(collected.ttfb.value);
    if (collected.cls) {
      // A CLS of 0 is a real, good result — do not treat it as missing.
      metrics.cls = Math.round(collected.cls.value * 1000) / 1000;
      const target = collected.cls.attribution?.largestShiftTarget;
      if (target) metrics.clsLargestShiftTarget = target;
    }
    if (collected.inp) metrics.inp = round(collected.inp.value);

    // TBT: long-task time beyond the 50ms budget, counted after FCP. Lighthouse
    // bounds the window at TTI; we have no TTI, so this is the FCP-onward sum —
    // close on typical pages, an overestimate on ones busy long after load.
    const longTasks =
      (window as unknown as { __longTasks?: { start: number; duration: number }[] }).__longTasks;
    if (longTasks && metrics.fcp !== undefined) {
      const fcp = metrics.fcp;
      const blocking = longTasks
        .filter((task) => task.start + task.duration > fcp)
        .reduce((total, task) => total + Math.max(0, task.duration - 50), 0);
      metrics.tbt = round(blocking);
    }

    return metrics;
  });
}


/**
 * Get the current browser instance (for advanced usage)
 * @returns Promise resolving to Browser instance, or null if not initialized
 */
export async function getBrowser(): Promise<Browser | null> {
  return browserPromise ? browserPromise : null;
}
