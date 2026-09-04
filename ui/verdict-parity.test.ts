/**
 * The dashboard's half of the cross-surface verdict contract.
 *
 * `src/` cannot import from `ui/` — the build's `rootDir` is `src` — so the
 * assertion that the React surfaces agree with every reporter runs from here,
 * which is the side allowed to reach across through `@core`.
 *
 * The reporters' half is `src/reporters/verdict-contract.test.ts`.
 */
import { describe, it, expect } from 'vitest';
import { scoreToVerdict } from '@core/verdict.js';
import { getScoreLabel, getScoreColor } from './lib/format.js';

const SCORES = [100, 95, 90, 89, 85, 80, 79, 75, 70, 69, 60, 55, 50, 49, 30, 0];

describe('dashboard verdict parity', () => {
  it('shows the same label as every other surface, at every score', () => {
    for (const score of SCORES) {
      expect(getScoreLabel(score), `score ${score}`).toBe(scoreToVerdict(score).label);
    }
  });

  it('colours from the shared token, so colour is not a fourth grade scale', () => {
    for (const score of SCORES) {
      expect(getScoreColor(score), `score ${score}`).toBe(
        `var(--color-${scoreToVerdict(score).colorToken})`
      );
    }
  });

  it('never returns a colour literal', () => {
    for (const score of SCORES) {
      expect(getScoreColor(score)).not.toMatch(/#[0-9a-f]{3,8}/i);
    }
  });
});
