// Regression: ISSUE-016 — rules with nothing to grade reported a verdict anyway
// Found by /qa on 2026-10-15
// Report: .gstack/qa-reports/run-20261015T075717Z/qa-report-developer-mozilla-org-2026-10-15.md
//
// On developer.mozilla.org, which has no JSON-LD, schema-valid, schema-type
// and schema-required-fields each warned (weight 25 apiece) about the absence
// schema-present already reports: 100 of the category's 202 weight on one
// fact. eeat-author-expertise warned that its check was "not applicable".
// a11y-color-contrast passed having examined 0 elements: it reads inline
// styles only, and MDN colours everything from stylesheets. In the 6-page
// crawl, the entity rules and eeat-nap-consistency passed on a graph with no
// structured data in it ("Organization names agree on phone and address").
// The codebase's convention for these cases is not measured (security-csp-xss).
import { describe, it, expect } from 'vitest';
import { createTestContext } from './test-context.js';
import { structuredDataValidRule } from './schema/valid.js';
import { structuredDataTypeRule } from './schema/type.js';
import { structuredDataRequiredFieldsRule } from './schema/required-fields.js';
import { authorExpertiseRule } from './eeat/author-expertise.js';
import { colorContrastRule } from './a11y/color-contrast.js';
import { entityConflictRule } from './schema/entity-conflict.js';
import { entityDanglingRule } from './schema/entity-dangling.js';
import { entityTypeDriftRule } from './schema/entity-type-drift.js';
import { entitySplitRule } from './schema/entity-split.js';
import { napConsistencyRule } from './eeat/nap-consistency.js';
import type { SiteContext, SitePageInfo } from '../types.js';

const PLAIN = '<html><head><title>T</title></head><body><main><p>Plain page.</p></main></body></html>';

describe('rules with nothing to grade (ISSUE-016)', () => {
  it.each([
    ['schema-valid', structuredDataValidRule],
    ['schema-type', structuredDataTypeRule],
    ['schema-required-fields', structuredDataRequiredFieldsRule],
    ['eeat-author-expertise', authorExpertiseRule],
    ['a11y-color-contrast', colorContrastRule],
  ])('%s is not measured on a page that gives it nothing to grade', async (_id, rule) => {
    expect((await rule.run(createTestContext(PLAIN))).status).toBe('not-measured');
  });

  it('a11y-color-contrast still grades inline colours when there are some', async () => {
    const html = '<html><body><p style="color:#eee;background-color:#fff">Faint</p></body></html>';
    expect((await colorContrastRule.run(createTestContext(html))).status).not.toBe('not-measured');
  });

  it.each([
    ['schema-entity-conflict', entityConflictRule],
    ['schema-entity-dangling', entityDanglingRule],
    ['schema-entity-type-drift', entityTypeDriftRule],
    ['schema-entity-split', entitySplitRule],
    ['eeat-nap-consistency', napConsistencyRule],
  ])('%s is not measured when no crawled page carries structured data', async (_id, rule) => {
    const pages = new Map<string, SitePageInfo>([
      ['https://example.com/a', {} as SitePageInfo],
      ['https://example.com/b', {} as SitePageInfo],
    ]);
    const site = { pageCount: 2, pages, normalize: (url: string) => url } as unknown as SiteContext;
    const result = await rule.run(createTestContext(PLAIN, { url: 'https://example.com/a', site }));
    expect(result.status).toBe('not-measured');
  });
});
