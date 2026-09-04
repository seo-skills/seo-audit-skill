// Regression: ISSUE-001 — an HTTP error status was audited as a normal page
// Found by /qa on 2026-09-04
// Report: .gstack/qa-reports/qa-report-127-0-0-1-2026-09-04.md
//
// A 404 was fetched, parsed, scored and reported like any other document. The
// score read healthy rather than obviously wrong, because most rules pass when
// the thing they check is absent: a typo'd URL came back 87/100 for a page that
// does not exist. `http-error` was declared in the error union with a hint
// written for it, and nothing ever threw it.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createAuditor } from './index.js';
import { AuditError } from './errors.js';

const PAGE_URL = 'https://example.test/';

const FIXTURE_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Regression Fixture</title>
  <meta name="description" content="Fixture page for the HTTP status regression test.">
  <link rel="canonical" href="${PAGE_URL}">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body>
  <h1>Regression Fixture</h1>
  <p>Body content, so the page is auditable on every axis except its status.</p>
</body>
</html>`;

/**
 * Serves the fixture body at `status`, so the only thing under test is the
 * status code. A 404 that returns a real HTML error page is the case that
 * scored 87: the body is perfectly auditable, and that is the problem.
 */
function makeFetchStub(status: number) {
  return vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url === PAGE_URL) {
      return new Response(FIXTURE_HTML, {
        status,
        headers: { 'content-type': 'text/html; charset=utf-8' },
      });
    }
    return new Response('', { status: 404 });
  });
}

describe('audit() refuses to score an HTTP error page', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each([400, 404, 410, 500, 503])('throws http-error on %i', async (status) => {
    vi.stubGlobal('fetch', makeFetchStub(status));
    const auditor = createAuditor({ categories: ['core'], measureCwv: false });

    await expect(auditor.audit(PAGE_URL)).rejects.toBeInstanceOf(AuditError);
    await expect(auditor.audit(PAGE_URL)).rejects.toMatchObject({ code: 'http-error' });
  });

  it('names the status in the message, so the reason is not guesswork', async () => {
    vi.stubGlobal('fetch', makeFetchStub(404));
    const auditor = createAuditor({ categories: ['core'], measureCwv: false });

    await expect(auditor.audit(PAGE_URL)).rejects.toThrow(/404/);
  });

  it('still audits a 200, and does not become a blanket refusal', async () => {
    vi.stubGlobal('fetch', makeFetchStub(200));
    const auditor = createAuditor({ categories: ['core'], measureCwv: false });

    const result = await auditor.audit(PAGE_URL);
    expect(result.overallScore).toBeGreaterThan(0);
  });
});
