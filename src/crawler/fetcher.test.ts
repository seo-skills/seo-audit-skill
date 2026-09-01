import { describe, it, expect } from 'vitest';
import { unauditableReason } from './fetcher.js';

/**
 * Regression: ISSUE-011 — non-HTML and empty responses were scored as pages
 * Found by /qa on 2026-09-01
 * Report: .gstack/qa-reports/qa-report-seomator-deep-2026-09-01.md
 *
 * Nothing checked what came back before parsing it with Cheerio, so a zero-byte
 * body scored 84/100 and a JSON response scored 83 — most rules pass when the
 * thing they check is simply absent.
 */
const URL = 'https://example.com/x';

describe('unauditableReason', () => {
  it('rejects an empty body', () => {
    expect(unauditableReason(URL, 'text/html', '')).toMatch(/empty response body/);
  });

  it('rejects a whitespace-only body', () => {
    expect(unauditableReason(URL, 'text/html', '   \n\t  ')).toMatch(/empty response body/);
  });

  it('rejects JSON', () => {
    expect(unauditableReason(URL, 'application/json', '{"a":1}')).toMatch(/not an HTML page/);
  });

  it('rejects plain text', () => {
    expect(unauditableReason(URL, 'text/plain', 'hello')).toMatch(/not an HTML page/);
  });

  it('rejects a PDF, which the URL filter still lets into a crawl', () => {
    expect(unauditableReason(URL, 'application/pdf', '%PDF-1.4')).toMatch(/not an HTML page/);
  });

  it('accepts text/html', () => {
    expect(unauditableReason(URL, 'text/html', '<html><body>hi</body></html>')).toBeNull();
  });

  it('accepts text/html with a charset parameter', () => {
    expect(
      unauditableReason(URL, 'text/html; charset=utf-8', '<html><body>hi</body></html>')
    ).toBeNull();
  });

  it('accepts XHTML', () => {
    expect(unauditableReason(URL, 'application/xhtml+xml', '<html><body/></html>')).toBeNull();
  });

  it('ignores header case and surrounding space', () => {
    expect(unauditableReason(URL, '  TEXT/HTML ; charset=UTF-8', '<html></html>')).toBeNull();
  });

  it('accepts markup when the server sends no Content-Type', () => {
    expect(unauditableReason(URL, null, '<!DOCTYPE html><html><body>hi</body></html>')).toBeNull();
  });

  it('rejects a body with no markup when there is no Content-Type to trust', () => {
    expect(unauditableReason(URL, null, 'just words')).toMatch(/no HTML markup/);
  });

  it('still audits an error page that returns real HTML', () => {
    // A custom 404 is worth auditing; only the unparseable is rejected.
    expect(unauditableReason(URL, 'text/html', '<html><body>Not found</body></html>')).toBeNull();
  });
});
