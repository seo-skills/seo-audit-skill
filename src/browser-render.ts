/**
 * Decide which browser work an audit does, from what the caller asked for.
 *
 * The browser render (headless Chrome, for Core Web Vitals, the rendered DOM
 * and the page's sub-resources) is the slow part of an audit: 8.6s with a cold
 * browser and 1.3s warm on a local page that audits in 0.4s without it, and
 * once per page under `--crawl`. So it runs only when asked for.
 *
 * The CLI (`--cwv`, `--mobile`, `--simulate-interaction`) and the dashboard's
 * run API both resolve their flags here. They used to decide separately, and
 * disagreed: the CLI rendered by default while the run form did not.
 */

/** What the caller asked for */
export interface BrowserRenderRequest {
  /**
   * Three states on purpose: `true` is `--cwv`, `false` is `--no-cwv`, and
   * `undefined` means the caller said nothing either way.
   */
  cwv?: boolean;
  /** `--mobile`: also render at a mobile viewport for the parity rules */
  mobile?: boolean;
  /** `--simulate-interaction`: click and scroll so INP can be measured */
  simulateInteraction?: boolean;
}

/** What the audit will actually do */
export interface BrowserRender {
  /** Render the page in a browser and measure Core Web Vitals */
  measureCwv: boolean;
  /** Render a second time at a mobile viewport. Never true without measureCwv. */
  mobile: boolean;
  /** Drive a synthetic interaction during the render. Never true without measureCwv. */
  simulateInteraction: boolean;
}

export function resolveBrowserRender(request: BrowserRenderRequest): BrowserRender {
  // `--mobile` and `--simulate-interaction` only mean something inside a render,
  // so asking for either asks for the render too. That keeps `audit --mobile`
  // doing what it did through 7.0.0. An explicit `--no-cwv` still wins.
  const wantsRenderedCheck = request.mobile === true || request.simulateInteraction === true;
  const measureCwv = request.cwv ?? wantsRenderedCheck;
  return {
    measureCwv,
    mobile: measureCwv && request.mobile === true,
    simulateInteraction: measureCwv && request.simulateInteraction === true,
  };
}
