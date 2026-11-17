/**
 * Custom checks: every where mode, scope, validation, the regex time limit,
 * the CI gate, and no effect on the score.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { createTestContext } from '../rules/test-context.js';
import { CustomRunner, customConfigProblems, regexTest } from './custom-checks.js';
import { validateConfig } from '../config/validator.js';
import { getDefaultConfig } from '../config/defaults.js';
import { evaluateGate } from '../gate.js';
import { Auditor } from '../auditor.js';
import type { CustomSearchConfig } from '../config/schema.js';

const HTML = `<html><head><meta name="x" content="Acme Old"></head><body><h1>Shop</h1><p>Price: <span itemprop="price">9.99</span></p><span class="sku">A1</span><span class="sku">B2</span></body></html>`;
const page = (url = 'https://example.com/products/a') => createTestContext(HTML, { url });
const run = (search: CustomSearchConfig, url?: string) => {
  const runner = new CustomRunner({ search: [search] });
  runner.runPage(page(url));
  return runner.results().searches[0];
};

describe('searches', () => {
  it('works in each where mode', () => {
    expect(run({ name: 't', where: 'text', text: 'Price:' }).failing).toBe(0);
    expect(run({ name: 'h', where: 'html', text: 'itemprop="price"' }).failing).toBe(0);
    expect(run({ name: 'hd', where: 'head', text: 'Acme Old', expect: 'absent' }).failing).toBe(1);
    expect(run({ name: 'b', where: 'body', text: '<h1>' }).failing).toBe(0);
    expect(run({ name: 's', where: 'selector', selector: '[itemprop=price]' }).failing).toBe(0);
    expect(run({ name: 's2', where: 'selector', selector: '[itemprop=price]', text: '^\\d+\\.\\d\\d$', match: 'regex' }).failing).toBe(0);
  });

  it('checks only pages in scope', () => {
    expect(run({ name: 'p', text: 'Price', scope: '/products/' }, 'https://example.com/blog/x').checked).toBe(0);
    expect(run({ name: 'p', text: 'Price', scope: '^/products/', match: 'regex' }).checked).toBe(1);
  });

  it('stops a catastrophic regular expression and reports it', () => {
    expect(regexTest('^(a+)+$', `${'a'.repeat(40)}!`)).toBeNull();
    const started = Date.now();
    const result = run({ name: 'slow', where: 'html', text: '^(<[a-z]+>)+$|(a+)+$', match: 'regex' });
    expect(Date.now() - started).toBeLessThan(2000);
    expect(result.checked + result.stopped).toBeGreaterThan(0);
  });
});

describe('extractions', () => {
  it('takes the first match, or every match', () => {
    const runner = new CustomRunner({ extract: [{ name: 'SKU', selector: '.sku' }, { name: 'All SKUs', selector: '.sku', multiple: true }, { name: 'Price', selector: '[itemprop=price]', attribute: 'itemprop' }] });
    runner.runPage(page());
    expect(runner.results().extractions.map((e) => e.pages[0].values)).toEqual([['A1'], ['A1', 'B2'], ['price']]);
  });
});

describe('validation', () => {
  it('names the entry index and name for a bad regex or selector', () => {
    const config = getDefaultConfig();
    config.custom.search = [{ name: 'Fine', text: 'x' }, { name: 'Broken', text: '(unclosed', match: 'regex' }];
    config.custom.extract = [{ name: 'Bad', selector: 'div[' }];
    // As `config validate` and `audit` print them: path, then message
    const messages = validateConfig(config).errors.map((e) => `${e.path}: ${e.message}`);
    expect(messages.some((m) => m.startsWith('custom.search[1] ("Broken"): text is not a valid regular expression'))).toBe(true);
    expect(messages.some((m) => m.startsWith('custom.extract[0] ("Bad"): selector "div[" is not valid CSS'))).toBe(true);
    expect(customConfigProblems({ search: [{ name: '', where: 'selector' }] }).length).toBe(2);
  });
});

describe('the gate', () => {
  const result = (search: Partial<ReturnType<typeof run>>) =>
    ({ overallScore: 90, categoryResults: [], extras: { custom: { searches: [{ name: 'Price', failCi: true, checked: 3, failing: 0, stopped: 0, ...search }], extractions: [] } } }) as never;
  it('exits 1 on a failing page, nothing checked, or a stopped page', () => {
    expect(evaluateGate(result({}), { failUnder: 70 }).exitCode).toBe(0);
    expect(evaluateGate(result({ failing: 2 }), { failUnder: 70 }).reason).toContain('custom search "Price" failed on 2 pages');
    expect(evaluateGate(result({ checked: 0 }), { failUnder: 70 }).reason).toContain('checked 0 pages');
    expect(evaluateGate(result({ stopped: 1 }), { failUnder: 70 }).exitCode).toBe(1);
  });
});

describe('the score', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('is identical with and without custom checks', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(HTML, { headers: { 'content-type': 'text/html' } })));
    const plain = await new Auditor({ categories: ['core'] }).audit('https://example.com/products/a');
    const custom = await new Auditor({ categories: ['core'], custom: { search: [{ name: 'Old brand', text: 'Shop', expect: 'absent', severity: 'fail' }] } }).audit('https://example.com/products/a');
    expect(custom.overallScore).toBe(plain.overallScore);
    expect(custom.extras?.custom?.searches[0]).toMatchObject({ checked: 1, failing: 1 });
  });
});

describe('custom results in a stored audit and the reports', () => {
  it('keep extracted values in their own table, and render in every format', async () => {
    const { tempDatabase } = await import('../storage/audits-db/test-fixtures.js');
    const { saveAuditToDatabase } = await import('../storage/save-audit.js');
    const { getAuditDetail } = await import('../dashboard/queries.js');
    const { renderMarkdownReport } = await import('../reporters/markdown-reporter.js');
    const { renderLlmReport } = await import('../reporters/llm-reporter.js');
    const { renderHtmlReport } = await import('../reporters/html-reporter.js');

    const runner = new CustomRunner({
      search: [{ name: 'Old brand', where: 'head', text: 'Acme Old', expect: 'absent', severity: 'fail' }],
      extract: [{ name: 'SKU', selector: '.sku', multiple: true }],
    });
    runner.runPage(page());
    const result = { url: 'https://example.com/', overallScore: 80, timestamp: '2026-11-17T00:00:00.000Z', crawledPages: 1, categoryResults: [], extras: { custom: runner.results() } };

    const temp = tempDatabase();
    try {
      const saved = saveAuditToDatabase(result, { db: temp.db });
      const row = temp.db.getDb().prepare('SELECT extras_json FROM audits WHERE audit_id = ?').get(saved.auditId) as { extras_json: string };
      expect(JSON.parse(row.extras_json).custom.extractions).toEqual([{ name: 'SKU', pages: [], pageCount: 1 }]);
      expect(getAuditDetail(temp.db, saved.auditId)!.result.extras?.custom).toEqual(result.extras.custom);
    } finally {
      temp.cleanup();
    }

    const md = renderMarkdownReport(result);
    expect(md).toContain('## Custom checks');
    expect(md).toContain('| SKU | https://example\\.com/products/a | B2 |');
    expect(renderLlmReport(result)).toMatch(/<search name="Old brand" result="fail">1 of 1 pages fail/);
    expect(renderHtmlReport(result)).toContain('Custom checks (not scored)');
  });
});
