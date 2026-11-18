/**
 * Accessibility with axe-core: grouping, the static rules that defer to axe,
 * and a real page in a real browser.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as http from 'node:http';
import type { AddressInfo } from 'node:net';
import { existsSync } from 'node:fs';
import { chromium } from 'playwright';
import { createTestContext } from '../test-context.js';
import { axeGroupRules, AXE_STATIC_EQUIVALENTS } from './axe-rules.js';
import { colorContrastRule } from './color-contrast.js';
import { Auditor } from '../../auditor.js';
import { fetchPageWithPlaywright, closeBrowser } from '../../crawler/playwright-fetcher.js';
import { AXE_PROBE, type AxeViolation } from '../../render/axe.js';
import { getRuleById } from '../registry.js';
import '../loader.js';

const rule = (key: string) => axeGroupRules.find((r) => r.id === `a11y-axe-${key}`)!;
const violation = (id: string, impact: AxeViolation['impact'] = 'serious'): AxeViolation => ({
  id,
  impact,
  tags: ['wcag2a'],
  help: `help for ${id}`,
  helpUrl: `https://dequeuniversity.com/rules/axe/4.14/${id}`,
  nodes: 2,
  targets: ['#a', '#b'],
});

function rendered(violations: AxeViolation[] | null) {
  const context = createTestContext('<html></html>');
  context.renderedHtml = '<html></html>';
  if (violations) context.probes = { axe: { version: '4.14.1', violations } };
  return context;
}

describe('grouped axe rules', () => {
  it('report each violation in its WCAG area, and serious ones fail', async () => {
    const context = rendered([violation('marquee'), violation('region', 'moderate')]);
    expect((await rule('media').run(context)).status).toBe('fail');
    expect((await rule('landmarks').run(context)).status).toBe('warn');
    expect((await rule('tables').run(context)).status).toBe('pass');
  });

  it('leave violations a static rule answers to that rule', async () => {
    expect(AXE_STATIC_EQUIVALENTS['image-alt']).toBe('images-alt-present');
    const result = await rule('other').run(rendered([violation('image-alt'), violation('color-contrast')]));
    expect(result.status).toBe('pass');
    for (const target of new Set(Object.values(AXE_STATIC_EQUIVALENTS))) expect(getRuleById(target), target).toBeDefined();
  });

  it('put an axe rule no group names under "other"', async () => {
    const result = await rule('other').run(rendered([violation('link-in-text-block')]));
    expect(result.status).toBe('fail');
    expect(result.details?.violations).toEqual([expect.objectContaining({ axeRule: 'link-in-text-block', wcag: ['wcag2a'] })]);
  });

  it('skip the axe rules disable_axe_rules lists', async () => {
    const landmarks = rule('landmarks');
    const result = await landmarks.run(rendered([violation('region')]), { disable_axe_rules: ['region'] });
    expect(result.status).toBe('pass');
  });

  it('are not measured when the engine did not run', async () => {
    expect(await rule('aria').run(rendered(null))).toMatchObject({ status: 'not-measured', reason: 'probe-failed' });
  });
});

describe('static rules that defer to axe', () => {
  it('a11y-color-contrast takes axe verdict when a render ran axe', async () => {
    const result = await colorContrastRule.run(rendered([violation('color-contrast')]));
    expect(result.status).toBe('fail');
    expect(result.details?.engine).toBe('axe-core 4.14.1');
  });

  it('and its own heuristic without one', async () => {
    const result = await colorContrastRule.run(createTestContext('<html><body><p>plain</p></body></html>'));
    expect(result.details?.engine).toBeUndefined();
  });
});

const FIXTURE_HTML = `<!doctype html><html lang="en"><head><title>Accessibility fixture</title></head><body>
  <p>Text outside any landmark.</p>
  <marquee>Scrolling news</marquee>
  <div role="button" aria-checked="true" tabindex="0">Toggle</div>
  <p style="color:#777777;background-color:#888888">Low contrast text</p>
</body></html>`;

const hasChromium = (() => {
  try {
    return existsSync(chromium.executablePath());
  } catch {
    return false;
  }
})();

describe.skipIf(!hasChromium)('axe in a real browser', () => {
  const server = http.createServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(FIXTURE_HTML);
  });
  let url = '';
  beforeAll(async () => {
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`;
  });
  afterAll(async () => {
    server.close();
    await closeBrowser();
  });

  it('finds the fixture violations, in the right rules', async () => {
    const result = await new Auditor({ measureCwv: true, categories: ['a11y'] }).audit(url);
    const byId = new Map(result.categoryResults[0].results.map((r) => [r.ruleId, r]));
    expect(byId.get('a11y-axe-media')?.status).toBe('fail');
    expect(byId.get('a11y-axe-aria')?.status).toBe('fail');
    expect(byId.get('a11y-axe-landmarks')?.status).toBe('warn');
    expect(byId.get('a11y-color-contrast')).toMatchObject({ status: 'fail', details: expect.objectContaining({ engine: expect.stringContaining('axe-core') }) });
  }, 60_000);

  it('adds under 1.5 s to a render', async () => {
    const withoutAxe = performance.now();
    await fetchPageWithPlaywright(url, 30000, { probes: [] });
    const plain = performance.now() - withoutAxe;
    const withAxe = performance.now();
    const render = await fetchPageWithPlaywright(url, 30000, { probes: [AXE_PROBE] });
    expect(render.probes?.['axe']).toBeDefined();
    expect(performance.now() - withAxe - plain).toBeLessThan(1500);
  }, 60_000);

  it('marks the axe rules not measured on a static run', async () => {
    const result = await new Auditor({ measureCwv: false, categories: ['a11y'] }).audit(url);
    const axe = result.categoryResults[0].results.filter((r) => r.ruleId.startsWith('a11y-axe-'));
    expect(axe).toHaveLength(10);
    expect(axe.every((r) => r.status === 'not-measured' && r.reason === 'needs-render')).toBe(true);
  }, 60_000);
});
