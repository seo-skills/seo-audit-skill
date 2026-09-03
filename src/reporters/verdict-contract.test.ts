/**
 * One audit, one verdict — asserted across every surface that renders one.
 *
 * This is the test that would have caught the defect this work exists to fix: a
 * score of 55 printed **D** in the terminal and **F** in the report handed to an
 * LLM, from two independently maintained bucket tables.
 *
 * The dashboard's half lives in `ui/verdict-parity.test.ts`: `src/` must not
 * import from `ui/` (the build's `rootDir` is `src`), so the parity assertion
 * runs from the side that is allowed to cross.
 */
import { describe, it, expect } from 'vitest';
import { scoreToVerdict } from '../verdict.js';
import { getLetterGrade } from './banner.js';
import { renderHtmlReport } from './html-reporter.js';
import { renderMarkdownReport } from './markdown-reporter.js';
import { renderLlmReport } from './llm-reporter.js';
import type { AuditResult } from '../types.js';

/** A minimal result at a chosen score; the body does not matter, the header does */
function resultAt(score: number): AuditResult {
  return {
    url: 'https://verdict.test/',
    overallScore: score,
    categoryResults: [
      {
        categoryId: 'core',
        score,
        passCount: 1,
        warnCount: 0,
        failCount: 0,
        notMeasuredCount: 0,
        results: [{ ruleId: 'core-title-present', status: 'pass', score: 100, message: 'ok', weight: 1 }],
      },
    ],
    timestamp: new Date('2026-09-03T12:00:00Z').toISOString(),
    crawledPages: 1,
  };
}

/** Every score band, plus both sides of every boundary */
const SCORES = [100, 95, 90, 89, 85, 80, 79, 75, 70, 69, 60, 55, 50, 49, 30, 0];

describe('one verdict across every surface', () => {
  it('the terminal grade matches the shared verdict at every score', () => {
    for (const score of SCORES) {
      expect(getLetterGrade(score).grade, `score ${score}`).toBe(scoreToVerdict(score).grade);
    }
  });

  it('the LLM report grade matches the shared verdict at every score', () => {
    for (const score of SCORES) {
      const xml = renderLlmReport(resultAt(score));
      const grade = /grade="([^"]*)"/.exec(xml)?.[1];
      expect(grade, `score ${score}`).toBe(scoreToVerdict(score).grade);
    }
  });

  it('the HTML report label matches the shared verdict at every score', () => {
    for (const score of SCORES) {
      const html = renderHtmlReport(resultAt(score));
      expect(html, `score ${score}`).toContain(scoreToVerdict(score).label);
    }
  });

  it('the markdown report label matches the shared verdict at every score', () => {
    for (const score of SCORES) {
      const md = renderMarkdownReport(resultAt(score));
      expect(md, `score ${score}`).toContain(scoreToVerdict(score).label);
    }
  });

  it('the terminal and the LLM report agree on 50-59, which they did not before', () => {
    // The regression this whole release exists for.
    for (const score of [50, 55, 59]) {
      const terminal = getLetterGrade(score).grade;
      const llm = /grade="([^"]*)"/.exec(renderLlmReport(resultAt(score)))?.[1];
      expect(terminal, `score ${score}`).toBe('D');
      expect(llm, `score ${score}`).toBe('D');
    }
  });
});
