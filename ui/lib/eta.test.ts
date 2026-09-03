/**
 * A projection that is wrong is worse than no projection: a countdown that
 * stalls or runs backwards reads as a broken tool. These pin the cases where it
 * must stay silent.
 */
import { describe, it, expect } from 'vitest';
import { runTiming, formatDuration } from './eta.js';

const T0 = Date.parse('2026-09-03T12:00:00.000Z');
const at = (seconds: number) => T0 + seconds * 1000;

describe('runTiming', () => {
  it('reports elapsed from the run start', () => {
    const t = runTiming({
      startedAt: new Date(T0).toISOString(),
      firstPageAt: null,
      lastPageAt: null,
      completed: 0,
      total: 8,
      crawling: true,
      now: at(90),
    });
    expect(t.elapsedSeconds).toBe(90);
  });

  it('makes no projection while crawling', () => {
    // Page count is still being discovered, so the denominator is not known.
    expect(
      runTiming({
        startedAt: new Date(T0).toISOString(),
        firstPageAt: new Date(at(10)).toISOString(),
        lastPageAt: new Date(at(50)).toISOString(),
        completed: 3,
        total: 8,
        crawling: true,
        now: at(70),
      }).remainingSeconds
    ).toBeNull();
  });

  it('makes no projection from a single completed page', () => {
    expect(
      runTiming({
        startedAt: new Date(T0).toISOString(),
        firstPageAt: new Date(at(30)).toISOString(),
        lastPageAt: new Date(at(30)).toISOString(),
        completed: 1,
        total: 8,
        crawling: false,
        now: at(60),
      }).remainingSeconds
    ).toBeNull();
  });

  it('projects from the steady-state rate, not from the run start', () => {
    // 30s of crawl and browser launch, then 3 pages in 60s => 20s per page.
    // Five pages left: 100s. Measuring from startedAt would say 150s.
    // 30s of crawl and browser launch, then pages complete at 50, 70 and 90 =>
    // 20s per page over three intervals. Four pages left: 80s, less the 0s the
    // current page has been running. Measuring from startedAt would say 150s.
    const t = runTiming({
      startedAt: new Date(T0).toISOString(),
      firstPageAt: new Date(at(30)).toISOString(),
      lastPageAt: new Date(at(90)).toISOString(),
      completed: 4,
      total: 8,
      crawling: false,
      now: at(90),
    });
    expect(t.remainingSeconds).toBe(80);
    expect(t.elapsedSeconds).toBe(90);
  });

  it('says nothing once every page is done', () => {
    expect(
      runTiming({
        startedAt: new Date(T0).toISOString(),
        firstPageAt: new Date(at(10)).toISOString(),
        lastPageAt: new Date(at(80)).toISOString(),
        completed: 8,
        total: 8,
        crawling: false,
        now: at(100),
      }).remainingSeconds
    ).toBeNull();
  });

  it('counts down between page completions, never up', () => {
    // The bug this replaced: dividing by `now` made the rate climb while a page
    // was in flight, so a real four-page crawl reported 76s left, then 86, 97,
    // 107, 117, 127 — growing, with nothing wrong.
    const base = {
      startedAt: new Date(T0).toISOString(),
      firstPageAt: new Date(at(30)).toISOString(),
      lastPageAt: new Date(at(90)).toISOString(),
      completed: 4,
      total: 8,
      crawling: false,
    };
    const series = [0, 5, 10, 20, 40].map(
      (dt) => runTiming({ ...base, now: at(90 + dt) }).remainingSeconds
    );
    expect(series).toEqual([80, 75, 70, 60, 40]);
    for (let i = 1; i < series.length; i++) {
      expect(series[i]!).toBeLessThan(series[i - 1]!);
    }
  });

  it('withdraws the estimate rather than showing zero on an overrun', () => {
    // Past its own projection, the projection was wrong. "0s left" on a run
    // that is still going is a worse answer than not saying.
    expect(
      runTiming({
        startedAt: new Date(T0).toISOString(),
        firstPageAt: new Date(at(30)).toISOString(),
        lastPageAt: new Date(at(90)).toISOString(),
        completed: 7,
        total: 8,
        crawling: false,
        now: at(200),
      }).remainingSeconds
    ).toBeNull();
  });

  it('survives a missing or unparseable timestamp', () => {
    const t = runTiming({
      startedAt: null,
      firstPageAt: 'not a date',
      lastPageAt: 'also not a date',
      completed: 4,
      total: 8,
      crawling: false,
      now: at(90),
    });
    expect(t.elapsedSeconds).toBe(0);
    expect(t.remainingSeconds).toBeNull();
  });
});

describe('formatDuration', () => {
  it.each([
    [0, '0s'],
    [45, '45s'],
    [60, '1m'],
    [95, '1m 35s'],
    [3600, '1h 0m'],
    [3725, '1h 2m'],
  ])('renders %i seconds as %s', (seconds, expected) => {
    expect(formatDuration(seconds)).toBe(expected);
  });
});
