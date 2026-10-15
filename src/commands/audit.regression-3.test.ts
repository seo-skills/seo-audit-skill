// Regression: `audit` saved its run profile without the scoring model
// Found on 2026-10-15 while adding --staging
//
// `audit` built the `run` it stores by hand from CLI options, and left out the
// fields only the auditor knows: `scoringVersion`, the rule filters and now
// `staging`. Every CLI audit in the history database lacked `scoringVersion`,
// so `compare` read audits from two scoring models as like-for-like. The
// version exists so that an upgrade which moves scores — 5.0.0's weights,
// 6.0.0's caps — is reported as a model change and not failed as a regression
// by `--fail-on-regression`. For CLI audits it never was.
//
// `analyze` already recorded it. This asserts the save call in the same way
// analyze.regression-1 does, rather than driving the whole CLI.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./audit.ts', import.meta.url).pathname, 'utf8');
const saveCall = source.slice(source.indexOf('saveAuditToDatabase(result'));

describe('the run audit stores', () => {
  it("starts from the auditor's own record", () => {
    // The auditor's record carries scoringVersion, enableRules, disableRules
    // and staging; the CLI's fields are spread over it.
    expect(saveCall).toMatch(/run:\s*\{[\s\S]*?\.\.\.result\.run,/);
  });

  it('passes --staging to the auditor', () => {
    expect(source).toMatch(/staging:\s*options\.staging/);
  });
});
