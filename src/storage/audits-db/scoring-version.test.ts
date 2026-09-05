// 5.0.0 — a scoring-model change is a run difference, not a site regression
// Decided by /qa on 2026-09-05
//
// Raising the core presence weights moves every stored score. Without a marker,
// `compare` would read a 5.0.0 audit against a 4.1.0 one and report the
// difference as a regression, and `--fail-on-regression` would fail a CI build
// over a site that did not change. That is the exact failure `run-profile.ts`
// was written to prevent for measurement options, extended to the scoring model
// itself.
import { describe, it, expect } from 'vitest';
import { compareRunProfiles, hasMaterialDifference } from './run-profile.js';
import { SCORING_VERSION } from '../../scoring.js';
import type { AuditRunOptions } from '../../types.js';

const run = (over: Partial<AuditRunOptions> = {}): AuditRunOptions => ({
  crawl: false,
  maxPages: 1,
  concurrency: 3,
  measureCwv: false,
  mobile: false,
  simulateInteraction: false,
  categories: [],
  timeout: 30000,
  scoringVersion: SCORING_VERSION,
  ...over,
});

describe('the scoring model is recorded on the run', () => {
  it('is 2, the model that weights the core presence checks properly', () => {
    expect(SCORING_VERSION).toBe(2);
  });

  it('reports a model change as a difference', () => {
    const differences = compareRunProfiles(run({ scoringVersion: 1 }), run());
    expect(differences.map((d) => d.option)).toContain('scoring model');
  });

  it('calls that difference material, so compare does not read it as a regression', () => {
    // Without this, `compare --fail-on-regression` fails a build whose only
    // change was upgrading the tool.
    expect(hasMaterialDifference(compareRunProfiles(run({ scoringVersion: 1 }), run()))).toBe(true);
  });

  it('says nothing when both runs used the same model', () => {
    expect(compareRunProfiles(run(), run())).toEqual([]);
  });

  it('renders the versions, so the report names what changed', () => {
    const [difference] = compareRunProfiles(run({ scoringVersion: 1 }), run());
    expect(difference.previous).toBe('1');
    expect(difference.current).toBe('2');
  });
});

describe('an audit stored before the marker existed', () => {
  it('is not mistaken for a same-model run', () => {
    // Pre-5.0.0 rows carry no scoringVersion. Undefined against 2 has to read
    // as a difference, or every historical audit silently compares as
    // like-for-like against a differently-scored one.
    const { scoringVersion: _omitted, ...legacy } = run();
    const differences = compareRunProfiles(legacy as AuditRunOptions, run());
    expect(differences.map((d) => d.option)).toContain('scoring model');
  });
});
