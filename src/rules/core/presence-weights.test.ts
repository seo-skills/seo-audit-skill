// 5.0.0 — the core presence checks are weighted like fundamentals
// Decided by /qa on 2026-09-05, from the finding in the 2026-09-04 report
//
// `core-title-present`, `core-description-present`, `core-h1-present`,
// `core-viewport-present` and `core-canonical-present` were all weight 1, the
// bottom of a scale running to 25, while ten canonical edge-case rules sat at
// 6-8 and passed vacuously on a page with no canonical to examine.
//
// `<html><body><p>x</p></body></html>` — no title, description, lang,
// viewport, canonical or h1 — scored 84/100 overall with `core` at 85. A page
// missing its title lost a single weight-point.
//
// It read as an oversight rather than a policy because the product already
// weights presence checks heavily elsewhere: `schema-present` 25,
// `images-alt-present` 20, `core-title-present` 1.
//
// Measured after: core 85 → 47 on that page, 99 on a properly marked-up one.
// Real sites were unaffected or improved (growthmarketing.ai 94 → 94,
// livechatai.com 87 → 92), because they have the fundamentals and the
// fundamentals now count.
import { describe, it, expect } from 'vitest';
import { getRuleById } from '../registry.js';
import '../loader.js';

/** The five, with the weight each was given and why. */
const PRESENCE_WEIGHTS: Array<[string, number]> = [
  ['core-title-present', 25],
  ['core-viewport-present', 20],
  ['core-description-present', 15],
  ['core-h1-present', 15],
  ['core-canonical-present', 10],
];

describe('the core presence checks carry a fundamental’s weight', () => {
  it.each(PRESENCE_WEIGHTS)('%s is weight %i', (id, weight) => {
    expect(getRuleById(id)?.weight).toBe(weight);
  });

  it('none of them is weight 1 any more', () => {
    for (const [id] of PRESENCE_WEIGHTS) {
      expect(getRuleById(id)!.weight, `${id} is back at the bottom of the scale`).toBeGreaterThan(1);
    }
  });
});

describe('a missing fundamental outweighs a canonical edge case', () => {
  // The inversion that made a blank page score 84: a page with no canonical
  // banked ~63 weight-points of vacuous passes from these, while the presence
  // checks that failed carried one point each.
  const EDGE_CASES = [
    'core-canonical-conflicting',
    'core-canonical-outside-head',
    'core-canonical-loop',
    'core-canonical-header',
  ];

  it.each(EDGE_CASES)('core-title-present outweighs %s', (edge) => {
    expect(getRuleById('core-title-present')!.weight).toBeGreaterThan(getRuleById(edge)!.weight);
  });

  it('a missing title outweighs a duplicated one', () => {
    // `core-title-unique` was 5 against `core-title-present`'s 1, so "your
    // title is duplicated" counted five times "you have no title".
    expect(getRuleById('core-title-present')!.weight).toBeGreaterThan(
      getRuleById('core-title-unique')!.weight
    );
  });
});

describe('the weights sit against the product’s own precedent', () => {
  it('title matches the heaviest presence check in the product', () => {
    expect(getRuleById('core-title-present')!.weight).toBe(getRuleById('schema-present')!.weight);
  });

  it('viewport matches images-alt-present', () => {
    expect(getRuleById('core-viewport-present')!.weight).toBe(
      getRuleById('images-alt-present')!.weight
    );
  });

  it('canonical is the lightest of the five, being genuinely optional', () => {
    const weights = PRESENCE_WEIGHTS.map(([id]) => getRuleById(id)!.weight);
    expect(getRuleById('core-canonical-present')!.weight).toBe(Math.min(...weights));
  });
});
