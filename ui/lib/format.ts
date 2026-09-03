/**
 * Formatting helpers for the dashboard.
 *
 * The score-to-verdict mapping is NOT here: it lives in `src/verdict.ts` and is
 * shared with every reporter, because three copies of it is how the same score
 * came to be graded D in the terminal and F in the LLM report.
 */

import { scoreToVerdict, verdictCssVar, verdictStyle } from '@core/verdict.js';
import type { RuleStatus } from '@core/types.js';

export function getScoreColor(score: number): string {
  // Derived from the shared verdict, so a score cannot be green here and amber
  // in the report. Returns a CSS var, never a literal.
  return verdictCssVar(scoreToVerdict(score).colorToken);
}

/**
 * Foreground + background for a score badge, as a ready-to-spread style object.
 *
 * Callers must not derive the tint from `getScoreColor()`: that returns
 * `var(--color-pass)`, and `` `${color}15` `` appends to the string rather than
 * to a hex value, producing `var(--color-pass)15` — dropped by the browser.
 */
export { verdictStyle };

export function getScoreLabel(score: number): string {
  return scoreToVerdict(score).label;
}

export function formatRuleIdAsName(ruleId: string): string {
  return ruleId
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function getStatusIcon(status: RuleStatus): string {
  switch (status) {
    case 'pass': return '\u2713';
    case 'warn': return '!';
    case 'fail': return '\u2717';
    case 'not-measured': return '\u2013';
  }
}

export function getStatusColorClass(status: RuleStatus): string {
  switch (status) {
    case 'pass': return 'text-pass';
    case 'warn': return 'text-warn';
    case 'fail': return 'text-fail';
    case 'not-measured': return 'text-[var(--color-neutral)]';
  }
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * A URL that is safe to put in an `href`.
 *
 * Page URLs come from the sites we audit. The crawler only queues http(s)
 * URLs, so a `javascript:` or `data:` URL should never reach a stored audit —
 * but "should never" spanning the crawler, the database and the API is not a
 * guarantee this component can check. Making it local costs one function.
 *
 * @returns The URL, or undefined when it is not a web address
 */
export function safeHref(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url, window.location.origin);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : undefined;
  } catch {
    return undefined;
  }
}

/**
 * The design tokens a rule status is drawn in.
 *
 * Exhaustive over `RuleStatus` on purpose. This replaced ternary chains of the
 * form `pass ? … : warn ? … : fail`, which silently rendered anything that was
 * neither pass nor warn — a not-measured check included — in failure red.
 */
export function statusTokens(status: RuleStatus): { color: string; background: string } {
  switch (status) {
    case 'pass':
      return { color: 'var(--color-pass)', background: 'var(--color-pass-bg)' };
    case 'warn':
      return { color: 'var(--color-warn)', background: 'var(--color-warn-bg)' };
    case 'fail':
      return { color: 'var(--color-fail)', background: 'var(--color-fail-bg)' };
    case 'not-measured':
      return { color: 'var(--color-neutral)', background: 'var(--color-neutral-bg)' };
  }
}
