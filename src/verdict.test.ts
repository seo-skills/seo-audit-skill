/**
 * The verdict is the product's answer. Every surface has to give the same one.
 */
import { describe, it, expect } from 'vitest';
import { scoreToVerdict, verdictCssVar, verdictStyle } from './verdict.js';

describe('scoreToVerdict', () => {
  it('grades the five buckets at their boundaries', () => {
    expect(scoreToVerdict(100)).toMatchObject({ grade: 'A', label: 'Excellent' });
    expect(scoreToVerdict(90)).toMatchObject({ grade: 'A', label: 'Excellent' });
    expect(scoreToVerdict(89)).toMatchObject({ grade: 'B', label: 'Good' });
    expect(scoreToVerdict(80)).toMatchObject({ grade: 'B', label: 'Good' });
    expect(scoreToVerdict(79)).toMatchObject({ grade: 'C', label: 'Fair' });
    expect(scoreToVerdict(70)).toMatchObject({ grade: 'C', label: 'Fair' });
    expect(scoreToVerdict(69)).toMatchObject({ grade: 'D', label: 'Needs Work' });
    expect(scoreToVerdict(50)).toMatchObject({ grade: 'D', label: 'Needs Work' });
    expect(scoreToVerdict(49)).toMatchObject({ grade: 'F', label: 'Poor' });
    expect(scoreToVerdict(0)).toMatchObject({ grade: 'F', label: 'Poor' });
  });

  it('settles the boundary the surfaces used to disagree on', () => {
    // 50-59 was D in the terminal and F in the LLM report. It is D now,
    // matching the terminal, which is the default output.
    for (const score of [50, 55, 59]) {
      expect(scoreToVerdict(score).grade, `score ${score}`).toBe('D');
    }
  });

  it('distinguishes "nothing could be measured" from "scored zero"', () => {
    // calculateOverallScore() returns 0 when total weight is 0. Grading that F
    // would say the site is catastrophic when the truth is nothing ran.
    expect(scoreToVerdict(null)).toMatchObject({ grade: '—', label: 'Not scored' });
    expect(scoreToVerdict(undefined)).toMatchObject({ grade: '—', label: 'Not scored' });
    expect(scoreToVerdict(NaN)).toMatchObject({ grade: '—', label: 'Not scored' });
    expect(scoreToVerdict(0)).toMatchObject({ grade: 'F' });
  });

  it('carries the colour as a token, so colour cannot become a fourth grade scale', () => {
    expect(scoreToVerdict(95).colorToken).toBe('pass');
    expect(scoreToVerdict(85).colorToken).toBe('pass');
    expect(scoreToVerdict(75).colorToken).toBe('warn');
    expect(scoreToVerdict(55).colorToken).toBe('orange');
    expect(scoreToVerdict(30).colorToken).toBe('fail');
    expect(scoreToVerdict(null).colorToken).toBe('neutral');
    expect(verdictCssVar('pass')).toBe('var(--color-pass)');
  });

  it('never returns a bare hex literal', () => {
    for (const score of [100, 85, 75, 55, 10, null]) {
      expect(verdictCssVar(scoreToVerdict(score).colorToken)).toMatch(/^var\(--color-[a-z]+\)$/);
    }
  });
});

describe('verdictStyle', () => {
  it('pairs every colour with a background that exists as a token', () => {
    for (const score of [100, 95, 85, 75, 60, 30, 0]) {
      const style = verdictStyle(score);
      expect(style.color).toMatch(/^var\(--color-[a-z]+\)$/);
      expect(style.backgroundColor).toMatch(/^var\(--color-[a-z]+-bg\)$/);
      // The pair must name the same token, or a green badge gets an amber tint.
      const fg = style.color.match(/--color-([a-z]+)\)/)![1];
      const bg = style.backgroundColor.match(/--color-([a-z]+)-bg\)/)![1];
      expect(bg).toBe(fg);
    }
  });

  it('never returns a value that could take a hex alpha suffix', () => {
    // Guards the alpha-suffix bug class at its source: a var() string cannot
    // take one, so the value must never look like a hex literal.
    for (const score of [100, 85, 60, 0, null]) {
      expect(verdictStyle(score).color).not.toMatch(/^#/);
    }
  });
});
