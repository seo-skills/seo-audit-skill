/**
 * Electron BrowserWindow-based page fetcher.
 *
 * Replaces Playwright inside the Electron app so we don't need an
 * external Chromium binary (which macOS Gatekeeper blocks inside .app bundles).
 * Returns the same PlaywrightFetchResult interface so the Auditor is agnostic.
 */

import { BrowserWindow, session } from 'electron';
import type { PlaywrightFetchResult } from '@core/crawler/index.js';
import type { CoreWebVitals } from '@core/types.js';

/**
 * Fetch a page using a hidden Electron BrowserWindow.
 * Captures rendered HTML, HTTP status code, response time, and Core Web Vitals.
 */
export async function fetchPageWithBrowserWindow(
  url: string,
  timeout = 30000,
): Promise<PlaywrightFetchResult> {
  // Dedicated session so interceptors don't affect the main window
  const ses = session.fromPartition(`cwv-fetch-${Date.now()}`);

  // Capture the status code from the main-frame navigation response
  let statusCode = 0;
  ses.webRequest.onHeadersReceived(
    { urls: ['*://*/*'] },
    (details, callback) => {
      // Only capture the top-level navigation, not sub-resources
      if (details.resourceType === 'mainFrame') {
        statusCode = details.statusCode;
      }
      callback({});
    },
  );

  const win = new BrowserWindow({
    show: false,
    width: 1280,
    height: 720,
    webPreferences: {
      sandbox: true,
      nodeIntegration: false,
      contextIsolation: true,
      session: ses,
    },
  });

  try {
    const startTime = performance.now();

    // Navigate to the URL
    await win.loadURL(url);

    const loadTime = performance.now() - startTime;

    // Wait for dynamic content (mirrors Playwright fetcher's 1s wait)
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Get rendered HTML
    const html = await win.webContents.executeJavaScript(
      'document.documentElement.outerHTML',
    );

    // Measure Core Web Vitals
    const cwv = await measureCwvInWindow(win);

    return {
      html,
      statusCode,
      responseTime: Math.round(loadTime),
      cwv,
    };
  } finally {
    win.destroy();
  }
}

/**
 * Measure Core Web Vitals via executeJavaScript.
 * Uses the same PerformanceObserver approach as playwright-fetcher.ts.
 */
async function measureCwvInWindow(win: BrowserWindow): Promise<CoreWebVitals> {
  return win.webContents.executeJavaScript(`
    new Promise((resolve) => {
      const metrics = {};

      // TTFB from Navigation Timing API
      const navEntry = performance.getEntriesByType('navigation')[0];
      if (navEntry) {
        metrics.ttfb = Math.round(navEntry.responseStart - navEntry.requestStart);
      }

      // FCP from Paint Timing API
      const paintEntries = performance.getEntriesByType('paint');
      for (const entry of paintEntries) {
        if (entry.name === 'first-contentful-paint') {
          metrics.fcp = Math.round(entry.startTime);
        }
      }

      // LCP via PerformanceObserver
      let lcpValue;
      let lcpObserver;
      try {
        lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const last = entries[entries.length - 1];
          if (last) lcpValue = Math.round(last.startTime);
        });
        lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
      } catch {}

      // CLS via PerformanceObserver
      let clsValue = 0;
      let clsObserver;
      try {
        clsObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (!entry.hadRecentInput) clsValue += entry.value;
          }
        });
        clsObserver.observe({ type: 'layout-shift', buffered: true });
      } catch {}

      setTimeout(() => {
        if (lcpObserver) lcpObserver.disconnect();
        if (clsObserver) clsObserver.disconnect();

        if (lcpValue !== undefined) metrics.lcp = lcpValue;
        metrics.cls = Math.round(clsValue * 1000) / 1000;

        resolve(metrics);
      }, 1000);
    })
  `);
}
