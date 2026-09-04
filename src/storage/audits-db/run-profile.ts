/**
 * Whether two audits were measured the same way.
 *
 * A score only means something next to another score if both were produced the
 * same way. The CLI measures Core Web Vitals by default (`--no-cwv` opts out)
 * and the desktop app defaults them off — and both write to the same history.
 * So `compare --fail-on-regression` could fail a CI build whose only change was
 * that the baseline came from the desktop app: ~55 rules go from measured to
 * unmeasured and the score moves for reasons the site had nothing to do with.
 *
 * The run options were already persisted in `run_json` from 3.4.0 onward.
 * Nothing read them until now.
 */

import type { AuditRunOptions } from '../types.js';

/** One way in which two runs were not comparable */
export interface ProfileDifference {
  option: string;
  previous: string;
  current: string;
  /** Whether this difference can move the score on its own */
  material: boolean;
}

/** Rendered as "Core Web Vitals" rather than "measureCwv" */
const LABELS: Record<string, string> = {
  measureCwv: 'Core Web Vitals',
  crawl: 'crawl mode',
  mobile: 'mobile parity',
  simulateInteraction: 'simulated interaction',
  categories: 'categories',
  enableRules: 'enabled rules',
  disableRules: 'disabled rules',
  maxPages: 'page limit',
};

/**
 * Options whose change alters which rules could produce a reading, and so
 * moves the score by itself. `maxPages` and `concurrency` change how much was
 * covered, not whether a check could run, so they are reported without being
 * called material.
 */
const MATERIAL = new Set([
  'measureCwv',
  'mobile',
  'simulateInteraction',
  'categories',
  // A rule filter removes checks outright, and a category left with no rules
  // is dropped from the result rather than scored zero. Both move the score
  // without the site changing, which is the whole reason this module exists.
  'enableRules',
  'disableRules',
]);

function render(value: unknown): string {
  if (Array.isArray(value)) return value.length ? value.join(', ') : 'all';
  return String(value);
}

/**
 * Compare how two audits were measured.
 *
 * @returns Every difference, or an empty list when the runs are comparable —
 *          which includes the case where either audit predates 3.6.0 and
 *          carries no profile, since an unknown profile is not a known
 *          difference.
 */
export function compareRunProfiles(
  previous: AuditRunOptions | null | undefined,
  current: AuditRunOptions | null | undefined
): ProfileDifference[] {
  if (!previous || !current) return [];

  const differences: ProfileDifference[] = [];
  for (const option of Object.keys(LABELS)) {
    const before = previous[option as keyof AuditRunOptions];
    const after = current[option as keyof AuditRunOptions];
    if (render(before) === render(after)) continue;
    differences.push({
      option: LABELS[option] ?? option,
      previous: render(before),
      current: render(after),
      material: MATERIAL.has(option),
    });
  }
  return differences;
}

/** Whether any difference can move the score on its own */
export function hasMaterialDifference(differences: ProfileDifference[]): boolean {
  return differences.some((d) => d.material);
}
