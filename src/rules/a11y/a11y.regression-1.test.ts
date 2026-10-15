// Regression: ISSUE-013 — a11y-touch-targets read non-targets in CSS as small touch targets
// Found by /qa on 2026-10-15
// Report: .gstack/qa-reports/run-20261015T075717Z/qa-report-developer-mozilla-org-2026-10-15.md
//
// On developer.mozilla.org all three "issues" were spurious: the search
// icon's ::before pseudo-element (matched twice) and the .visually-hidden
// utility. The pattern matched the letter "a" anywhere in a selector,
// spanned rule boundaries, and read max-width/line-height as width/height.
// axe-core's target-size check passes the page. The details also cited
// SC 2.5.8 as Level AAA with a 44px minimum; 44px is 2.5.5 (AAA), and 2.5.8
// (AA) asks for 24px.
import { describe, it, expect } from 'vitest';
import { createTestContext } from '../test-context.js';
import { touchTargetsRule } from './touch-targets.js';
import { formLabelsRule } from './form-labels.js';
import { landmarkRegionsRule } from './landmark-regions.js';

const withCss = (css: string) =>
  createTestContext(`<html><head><style>${css}</style></head><body><a href="/">Home</a></body></html>`);

describe('a11y-touch-targets CSS heuristics (ISSUE-013)', () => {
  it('ignores pseudo-elements, utility classes and properties that are not width/height', async () => {
    const css = [
      '.mdn-search-button:before{height:18px;width:15px}',
      '.visually-hidden{clip:rect(0 0 0 0);height:1px;width:1px;overflow:hidden}',
      '.nav a{line-height:20px;max-width:30px}',
      '.background{height:10px}',
    ].join('');
    const result = await touchTargetsRule.run(withCss(css));
    expect(result.status).toBe('pass');
  });

  it('still flags links and buttons sized below 44px', async () => {
    const css = 'button.close{width:20px;height:20px} .toolbar a{height:16px} .btn{height:30px}';
    const result = await touchTargetsRule.run(withCss(css));
    expect(result.status).toBe('warn');
    expect(result.details?.totalIssues).toBe(3);
  });

  it('cites the success criteria correctly', async () => {
    const result = await touchTargetsRule.run(withCss('button{width:20px}'));
    expect(String(result.details?.wcagReference)).toMatch(/2\.5\.5.*AAA/);
    expect(String(result.details?.wcagReference)).not.toMatch(/2\.5\.8 \(Level AAA\)/);
  });
});

// Regression: ISSUE-014 — a11y-form-labels ignored label text inside child elements
// Found by /qa on 2026-10-15
// Report: .gstack/qa-reports/run-20261015T075717Z/qa-report-developer-mozilla-org-2026-10-15.md
//
// A wrapping label's text was read with every child element removed, so
// <label><span>Email</span><input></label>, an ordinary labelled field, was
// reported as unlabelled.
describe('a11y-form-labels wrapping labels (ISSUE-014)', () => {
  const form = (body: string) => createTestContext(`<html><body><form>${body}</form></body></html>`);

  it('reads label text nested in child elements', async () => {
    const result = await formLabelsRule.run(form('<label><span>Email</span> <input type="email" name="e"></label>'));
    expect(result.status).toBe('pass');
  });

  it('does not take a select\'s option text for its label', async () => {
    const result = await formLabelsRule.run(form('<label><select name="s"><option>Pick one</option></select></label>'));
    expect(result.status).not.toBe('pass');
  });
});

// Regression: ISSUE-015 — a11y-landmark-regions warned "0 landmark region(s) missing"
// Found by /qa on 2026-10-15
// Report: .gstack/qa-reports/run-20261015T075717Z/qa-report-developer-mozilla-org-2026-10-15.md
//
// developer.mozilla.org has every landmark but four unlabelled <nav>s. The
// warn was right; its message said nothing was missing and hid the reason.
describe('a11y-landmark-regions messages (ISSUE-015)', () => {
  it('names the problem when every landmark is present but navs are unlabelled', async () => {
    const html = '<html><body><header></header><nav></nav><nav></nav><main></main><footer></footer></body></html>';
    const result = await landmarkRegionsRule.run(createTestContext(html));
    expect(result.status).toBe('warn');
    expect(result.message).not.toMatch(/^0 landmark/);
    expect(result.message).toMatch(/lack labels/);
  });

  it('does not list <main> twice when it is missing', async () => {
    const html = '<html><body><nav></nav></body></html>';
    const result = await landmarkRegionsRule.run(createTestContext(html));
    expect(result.message).toBe('Missing essential landmark: <main>. Also missing: banner/header, contentinfo/footer');
  });
});
