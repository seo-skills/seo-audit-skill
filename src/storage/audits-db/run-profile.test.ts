import { describe, it, expect } from 'vitest';
import { compareRunProfiles, hasMaterialDifference } from './run-profile.js';
import type { AuditRunOptions } from '../types.js';

const base: AuditRunOptions = {
  crawl: false,
  maxPages: 10,
  concurrency: 3,
  measureCwv: true,
  mobile: false,
  simulateInteraction: false,
  categories: [],
  timeout: 30000,
};

describe('compareRunProfiles', () => {
  it('finds nothing when both runs were measured the same way', () => {
    expect(compareRunProfiles(base, { ...base })).toEqual([]);
  });

  it('catches the CLI-versus-desktop trap', () => {
    // The CLI measures Core Web Vitals by default; the desktop app does not.
    // Both write to the same history, so this is the realistic case.
    const differences = compareRunProfiles({ ...base, measureCwv: false }, base);

    expect(differences).toHaveLength(1);
    expect(differences[0]).toMatchObject({
      option: 'Core Web Vitals',
      previous: 'false',
      current: 'true',
      material: true,
    });
    expect(hasMaterialDifference(differences)).toBe(true);
  });

  it('reports coverage changes without calling them material', () => {
    // Crawling more pages changes how much was covered, not whether a check
    // could take a reading, so it does not move the score by itself.
    const differences = compareRunProfiles(base, { ...base, maxPages: 50 });

    expect(differences).toHaveLength(1);
    expect(differences[0]!.material).toBe(false);
    expect(hasMaterialDifference(differences)).toBe(false);
  });

  it('treats a category filter as material', () => {
    const differences = compareRunProfiles(base, { ...base, categories: ['core'] });
    expect(differences[0]).toMatchObject({ option: 'categories', previous: 'all', current: 'core' });
    expect(hasMaterialDifference(differences)).toBe(true);
  });

  it('says nothing when either audit predates the recorded profile', () => {
    // An unknown profile is not a known difference. Audits stored before 3.6.0
    // carry no run options, and inventing a warning for them would cry wolf on
    // every comparison against existing history.
    expect(compareRunProfiles(null, base)).toEqual([]);
    expect(compareRunProfiles(base, undefined)).toEqual([]);
    expect(compareRunProfiles(null, null)).toEqual([]);
  });

  it('reports several differences at once', () => {
    const differences = compareRunProfiles(base, {
      ...base,
      measureCwv: false,
      crawl: true,
      maxPages: 40,
    });
    expect(differences.map((d) => d.option).sort()).toEqual([
      'Core Web Vitals',
      'crawl mode',
      'page limit',
    ]);
  });
});
