/**
 * Render probes reach the rules, and render-only rules say they need a render.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { runProbes, type RenderProbe } from './probes.js';
import { Auditor } from '../auditor.js';
import { registerRule } from '../rules/registry.js';
import { defineRule, pass } from '../rules/define-rule.js';
import { explainRule, formatExplanation, type RuleExplanation } from '../explain.js';
import type { PlaywrightFetchResult } from '../crawler/playwright-fetcher.js';

const probe = (id: string, timeoutMs = 1000): RenderProbe => ({ id, family: 'imageSizing', script: id, timeoutMs });

describe('runProbes', () => {
  it('keeps each result by id, as plain JSON', async () => {
    const results = await runProbes(async (script) => ({ ran: script, at: new Date(0) }), [probe('a'), probe('b')]);
    expect(results).toEqual({ a: { ran: 'a', at: '1970-01-01T00:00:00.000Z' }, b: { ran: 'b', at: '1970-01-01T00:00:00.000Z' } });
  });

  it('leaves out a probe that throws or times out, and still runs the rest', async () => {
    const results = await runProbes(
      async (script) => {
        if (script === 'throws') throw new Error('boom');
        if (script === 'hangs') return new Promise(() => {});
        return 1;
      },
      [probe('throws'), probe('hangs', 20), probe('fine')]
    );
    expect(results).toEqual({ fine: 1 });
  });
});

const ORIGIN = 'https://site.test';
const PAGE = '<!doctype html><html lang="en"><head><title>Probe page</title></head><body><a href="/b">b</a></body></html>';

function serve() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const path = new URL(String(input instanceof Request ? input.url : input)).pathname;
      if (path === '/' || path === '/b') return new Response(PAGE, { headers: { 'content-type': 'text/html' } });
      return new Response('', { status: 404 });
    })
  );
}

afterEach(() => vi.unstubAllGlobals());

describe('a probe result reaches a rule', () => {
  const seen: unknown[] = [];
  registerRule(
    defineRule({
      id: 'js-test-probe-reader',
      name: 'Test probe reader',
      description: 'Reads context.probes, for this test only',
      category: 'js',
      weight: 1,
      run: (context) => {
        seen.push(context.probes?.['test']);
        return pass('js-test-probe-reader', 'read');
      },
    })
  );
  const browserFetcher = async (url: string): Promise<PlaywrightFetchResult> => ({
    html: PAGE,
    statusCode: 200,
    responseTime: 1,
    cwv: {},
    probes: { test: { url } },
  });

  it('in a crawl, through the renderer unchanged', async () => {
    serve();
    seen.length = 0;
    await new Auditor({ measureCwv: true, categories: ['js'], browserFetcher }).auditWithCrawl(`${ORIGIN}/`, 2, 1);
    expect(seen).toEqual(expect.arrayContaining([{ url: `${ORIGIN}/` }, { url: `${ORIGIN}/b` }]));
  });

  it('in a single-page audit', async () => {
    serve();
    seen.length = 0;
    await new Auditor({ measureCwv: true, categories: ['js'], browserFetcher }).audit(`${ORIGIN}/`);
    expect(seen).toEqual([{ url: `${ORIGIN}/` }]);
  });
});

describe('render-only rules', () => {
  it('report needs-render without --cwv, without running', async () => {
    serve();
    const result = await new Auditor({ measureCwv: false, categories: ['js'] }).audit(`${ORIGIN}/`);
    const rendered = result.categoryResults[0].results.find((r) => r.ruleId === 'js-rendered-title')!;
    expect(rendered).toMatchObject({ status: 'not-measured', reason: 'needs-render', message: 'Needs a browser render: rerun with --render' });
  });

  it('report could-not-verify when the render ran and failed', async () => {
    serve();
    const failing = async (): Promise<PlaywrightFetchResult> => {
      throw new Error('browser crashed');
    };
    const result = await new Auditor({ measureCwv: true, categories: ['js'], browserFetcher: failing }).audit(`${ORIGIN}/`);
    const rendered = result.categoryResults[0].results.find((r) => r.ruleId === 'js-rendered-title')!;
    expect(rendered).toMatchObject({ status: 'not-measured', reason: 'could-not-verify' });
  });

  it('are named as such by explain', () => {
    const explanation = explainRule('cwv-lcp') as RuleExplanation;
    expect(explanation.requiresRender).toBe(true);
    expect(formatExplanation(explanation)).toContain('Needs a browser render');
  });
});
