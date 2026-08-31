import { describe, it, expect } from 'vitest';
import { consoleErrorsRule } from './console-errors.js';
import { failedRequestsRule } from './failed-requests.js';
import { renderedTitleRule } from './rendered-title.js';
import { calculateCategoryScore } from '../../scoring.js';
import type { AuditContext, RenderDiagnostics, RuleResult } from '../../types.js';
import * as cheerio from 'cheerio';

const HTML = '<html><head><title>T</title></head><body><h1>H</h1></body></html>';

function createContext(diagnostics?: RenderDiagnostics): AuditContext {
  return {
    url: 'https://example.com/',
    html: HTML,
    $: cheerio.load(HTML),
    headers: {},
    links: [],
    images: [],
    statusCode: 200,
    responseTime: 100,
    cwv: {},
    invalidLinks: [],
    specialLinks: [],
    figures: [],
    inlineSvgs: [],
    pictureElements: [],
    ...(diagnostics && { renderDiagnostics: diagnostics }),
  };
}

const empty: RenderDiagnostics = { pageErrors: [], consoleMessages: [], failedRequests: [] };

describe('consoleErrorsRule', () => {
  it('passes on a clean render', async () => {
    const result = await consoleErrorsRule.run(createContext(empty));
    expect(result.status).toBe('pass');
  });

  it('fails on an uncaught exception', async () => {
    const result = await consoleErrorsRule.run(
      createContext({ ...empty, pageErrors: ["ReferenceError: dataLayer is not defined"] })
    );
    expect(result.status).toBe('fail');
    expect(result.message).toContain('ReferenceError');
  });

  it('warns on a console error without an uncaught exception', async () => {
    const result = await consoleErrorsRule.run(
      createContext({
        ...empty,
        consoleMessages: [{ level: 'error', text: 'API request returned 500' }],
      })
    );
    expect(result.status).toBe('warn');
  });

  it('ignores extension and browser-intervention noise', async () => {
    // These come from the visitor's browser, not the page, and the site
    // owner cannot act on them.
    const result = await consoleErrorsRule.run(
      createContext({
        ...empty,
        consoleMessages: [
          { level: 'error', text: 'chrome-extension://abc/inject.js blocked' },
          { level: 'error', text: '[Intervention] Images loaded lazily' },
          { level: 'warning', text: 'Deprecated API' },
        ],
      })
    );
    expect(result.status).toBe('pass');
  });

  it('reports as unmeasured when rendering did not run', async () => {
    const result = await consoleErrorsRule.run(createContext());
    expect(result.weight).toBe(0);
  });
});

describe('failedRequestsRule', () => {
  it('passes when every resource loaded', async () => {
    const result = await failedRequestsRule.run(createContext(empty));
    expect(result.status).toBe('pass');
  });

  it('fails when a script 404s', async () => {
    // Invisible to a static parse: the <script> tag is present and well-formed.
    const result = await failedRequestsRule.run(
      createContext({
        ...empty,
        failedRequests: [
          {
            url: 'https://example.com/app.js',
            resourceType: 'script',
            method: 'GET',
            failure: 'HTTP 404',
            statusCode: 404,
          },
        ],
      })
    );
    expect(result.status).toBe('fail');
    expect(result.details?.indexingCriticalCount).toBe(1);
  });

  it('only warns when the failure cannot affect indexing', async () => {
    const result = await failedRequestsRule.run(
      createContext({
        ...empty,
        failedRequests: [
          {
            url: 'https://tracker.example/pixel.gif',
            resourceType: 'image',
            method: 'GET',
            failure: 'net::ERR_NAME_NOT_RESOLVED',
          },
        ],
      })
    );
    expect(result.status).toBe('warn');
  });

  it('reports as unmeasured when rendering did not run', async () => {
    const result = await failedRequestsRule.run(createContext());
    expect(result.weight).toBe(0);
  });
});

describe('js category scoring without rendering', () => {
  it('does not award a perfect score for checks that never ran', async () => {
    // Regression: js rules used to return pass() when the rendered DOM was
    // absent, so --no-cwv scored the category 100 having measured nothing.
    const noRender = createContext();
    const results: RuleResult[] = [
      await consoleErrorsRule.run(noRender),
      await failedRequestsRule.run(noRender),
      await renderedTitleRule.run(noRender),
    ];

    for (const result of results) {
      expect(result.weight).toBe(0);
    }
    // Nothing measurable means no score to report, not a free 100.
    expect(calculateCategoryScore(results)).toBe(0);
  });
});
