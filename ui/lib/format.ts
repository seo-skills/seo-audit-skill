/**
 * Formatting helpers for the dashboard.
 *
 * The score-to-verdict mapping is NOT here: it lives in `src/verdict.ts` and is
 * shared with every reporter, because three copies of it is how the same score
 * came to be graded D in the terminal and F in the LLM report.
 */

import { scoreToVerdict, verdictCssVar } from '@core/verdict.js';

export function getScoreColor(score: number): string {
  // Derived from the shared verdict, so a score cannot be green here and amber
  // in the report. Returns a CSS var, never a literal.
  return verdictCssVar(scoreToVerdict(score).colorToken);
}

export function getScoreColorClass(score: number): string {
  if (score >= 90) return 'text-pass';
  if (score >= 70) return 'text-warn';
  if (score >= 50) return 'text-[var(--color-orange)]';
  return 'text-fail';
}

export function getScoreBgClass(score: number): string {
  if (score >= 90) return 'bg-pass-bg';
  if (score >= 70) return 'bg-warn-bg';
  if (score >= 50) return 'bg-[var(--color-warn-bg)]';
  return 'bg-fail-bg';
}

export function getScoreLabel(score: number): string {
  return scoreToVerdict(score).label;
}

export function formatRuleIdAsName(ruleId: string): string {
  return ruleId
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function getStatusIcon(status: 'pass' | 'warn' | 'fail'): string {
  switch (status) {
    case 'pass': return '\u2713';
    case 'warn': return '!';
    case 'fail': return '\u2717';
  }
}

export function getStatusColorClass(status: 'pass' | 'warn' | 'fail'): string {
  switch (status) {
    case 'pass': return 'text-pass';
    case 'warn': return 'text-warn';
    case 'fail': return 'text-fail';
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
