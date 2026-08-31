import { describe, it, expect } from 'vitest';
import { lcpRule } from './lcp.js';
import { clsRule } from './cls.js';
import { fcpRule } from './fcp.js';
import { ttfbRule } from './ttfb.js';
import { inpRule } from './inp.js';
import { calculateCategoryScore } from '../../scoring.js';
import type { AuditContext, CoreWebVitals, RuleResult } from '../../types.js';
import * as cheerio from 'cheerio';

const HTML = '<html><body><p>Fixture</p></body></html>';

function createContext(cwv: CoreWebVitals): AuditContext {
  return {
    url: 'https://example.com/',
    html: HTML,
    $: cheerio.load(HTML),
    headers: {},
    links: [],
    images: [],
    statusCode: 200,
    responseTime: 100,
    cwv,
    invalidLinks: [],
    specialLinks: [],
    figures: [],
    inlineSvgs: [],
    pictureElements: [],
  };
}

const cwvRules = [
  { name: 'cwv-lcp', rule: lcpRule },
  { name: 'cwv-cls', rule: clsRule },
  { name: 'cwv-fcp', rule: fcpRule },
  { name: 'cwv-ttfb', rule: ttfbRule },
  { name: 'cwv-inp', rule: inpRule },
];

describe('Core Web Vitals rules with no measurement', () => {
  it.each(cwvRules)('$name carries weight 0 when the metric is absent', async ({ rule }) => {
    const result = await rule.run(createContext({}));
    expect(result.weight).toBe(0);
  });

  it('scores a category the same whether or not CWV were measured', async () => {
    // Running with --no-cwv must not cost a site points. An unmeasured metric
    // is not evidence of a slow page.
    const unmeasured: RuleResult[] = [];
    for (const { rule } of cwvRules) {
      unmeasured.push(await rule.run(createContext({})));
    }

    const otherPerfRules: RuleResult[] = [
      { ruleId: 'perf-brotli', status: 'pass', message: '', score: 100, weight: 10 },
      { ruleId: 'perf-http2', status: 'pass', message: '', score: 100, weight: 10 },
    ];

    expect(calculateCategoryScore([...otherPerfRules, ...unmeasured])).toBe(
      calculateCategoryScore(otherPerfRules)
    );
  });
});

describe('Core Web Vitals rules with measurements', () => {
  it('still scores normally when metrics are present', async () => {
    const good = createContext({ lcp: 1200, cls: 0.02, fcp: 900, ttfb: 300 });

    for (const { rule } of cwvRules.filter((r) => r.name !== 'cwv-inp')) {
      const result = await rule.run(good);
      expect(result.status).toBe('pass');
      expect(result.weight).toBeUndefined();
    }
  });

  it('fails a genuinely bad metric rather than skipping it', async () => {
    const result = await lcpRule.run(createContext({ lcp: 9000 }));
    expect(result.status).toBe('fail');
    expect(result.weight).toBeUndefined();
  });

  it('reports a synthetic INP as unweighted, however fast it is', async () => {
    // 8ms would be a great INP, but the crawler produced it by clicking an
    // arbitrary element. Scoring it would give a manufactured number the same
    // authority as field data.
    const result = await inpRule.run(createContext({ inp: 8, inpSynthetic: true }));

    expect(result.weight).toBe(0);
    expect(result.message).toContain('synthetic');
    expect(result.details?.synthetic).toBe(true);
  });

  it('scores a non-synthetic INP normally', async () => {
    const result = await inpRule.run(createContext({ inp: 8 }));

    expect(result.status).toBe('pass');
    // Unset, so the runner applies the rule's declared weight — unlike the
    // synthetic case, which pins it to 0.
    expect(result.weight).toBeUndefined();
    expect(result.details?.synthetic).toBeUndefined();
  });
});
