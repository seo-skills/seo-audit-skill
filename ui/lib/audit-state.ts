/**
 * What the audit detail page says about a run, beyond its findings: why a
 * check took no reading, whether a render would add checks, how much of the
 * site was measured. Pure functions, so the wording is tested once and both
 * surfaces (desktop and web) say the same thing.
 */
import type { AuditResult, NotMeasuredReason, RuleResult } from '../../src/types.js';
import { coverageLine } from '../../src/reporters/coverage-line.js';
import { isNotMeasured } from '../../src/rules/define-rule.js';

/** Each reason's label, and the one thing to do about it */
export const NOT_MEASURED_REASONS: Record<NotMeasuredReason, { label: string; action?: string }> = {
  'not-applicable': { label: 'did not apply' },
  'needs-render': { label: 'needs a browser render', action: 'Run again with "Render in a browser" on' },
  'needs-crawl': { label: 'needs a crawl', action: 'Run again with "Crawl linked pages" on' },
  'could-not-verify': { label: 'could not verify', action: 'Run again later; the site or a third party did not answer' },
  'not-compared': { label: 'not compared', action: 'Only indexable, self-canonical pages are compared' },
  'probe-failed': { label: 'check failed to run', action: 'Run again with rendering; the page did not answer the check' },
  disabled: { label: 'turned off in config', action: 'Turn it on in seomator.toml' },
  unsupported: { label: 'not supported here', action: 'Run it from the CLI or the web dashboard' },
  'rule-error': { label: 'check failed to run', action: 'Report it: this is a bug in the check, not your site' },
};

/** A not-measured result's reason; old rows without one count as "could not verify" */
export function reasonOf(result: Pick<RuleResult, 'reason'>): NotMeasuredReason {
  return result.reason ?? 'could-not-verify';
}

function allResults(result: AuditResult): RuleResult[] {
  return result.categoryResults.flatMap((category) => category.results);
}

/** Not-measured results grouped by reason, largest group first */
export function notMeasuredByReason(result: AuditResult): Array<{ reason: NotMeasuredReason; label: string; ruleIds: string[] }> {
  const groups = new Map<NotMeasuredReason, Set<string>>();
  for (const rule of allResults(result)) {
    if (!isNotMeasured(rule)) continue;
    const reason = reasonOf(rule);
    if (!groups.has(reason)) groups.set(reason, new Set());
    groups.get(reason)!.add(rule.ruleId);
  }
  return [...groups]
    .map(([reason, ids]) => ({ reason, label: NOT_MEASURED_REASONS[reason].label, ruleIds: [...ids].sort() }))
    .sort((a, b) => b.ruleIds.length - a.ruleIds.length || a.label.localeCompare(b.label));
}

/** "N checks need a browser render", or null when none do */
export function renderHint(result: AuditResult, browserRender: boolean): string | null {
  const count = notMeasuredByReason(result).find((group) => group.reason === 'needs-render')?.ruleIds.length ?? 0;
  if (count === 0) return null;
  const checks = `${count} check${count === 1 ? '' : 's'} need${count === 1 ? 's' : ''} a browser render`;
  return browserRender ? `${checks} · Run again with rendering` : `${checks}, which this build cannot do`;
}

/** How the run ended: every page measured, or some not */
export function completionLabel(result: AuditResult): 'Completed' | 'Completed with gaps' {
  if (result.completionState === 'completed-with-gaps') return 'Completed with gaps';
  const coverage = result.coverage;
  const gaps = (coverage?.rateLimited ?? 0) + (coverage?.failed ?? 0) + (coverage?.notFetched ?? 0);
  return gaps > 0 ? 'Completed with gaps' : 'Completed';
}

/** "Measured 4 of 5 pages · 1 rate-limited", when a crawl missed pages */
export function coverageText(result: AuditResult): string | null {
  return coverageLine(result);
}

/** Advisory findings: reported, not counted in the score yet */
export const ADVISORY_CHIP = 'Advisory · not counted in the score yet';

/** Counts the page's chip and stats show for advisory results */
export function advisoryCount(result: AuditResult): number {
  return allResults(result).filter((rule) => rule.advisory && !isNotMeasured(rule)).length;
}

/** The run page link for "Run again", carrying the stored run options */
export function rerunHref(startUrl: string, result: AuditResult, render = false): string {
  const params = new URLSearchParams({ url: startUrl });
  const run = result.run as { crawl?: boolean; maxPages?: number; measureCwv?: boolean } | undefined;
  if (render || run?.measureCwv) params.set('render', '1');
  if (run?.crawl) params.set('crawl', '1');
  if (run?.crawl && run.maxPages) params.set('maxPages', String(run.maxPages));
  return `/run?${params.toString()}`;
}
