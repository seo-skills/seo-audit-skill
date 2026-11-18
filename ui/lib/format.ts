/**
 * Formatting helpers for the dashboard.
 *
 * The score-to-verdict mapping is NOT here: it lives in `src/verdict.ts` and is
 * shared with every reporter, because three copies of it is how the same score
 * came to be graded D in the terminal and F in the LLM report.
 */

import { scoreToVerdict, verdictCssVar } from '@core/verdict.js';

export function getScoreColor(score: number): string {
  // Derived from the shared verdict, so a score cannot be one colour here and
  // another in the report: ink at 80 and above, amber below, red under 70.
  // Returns a CSS var, never a literal.
  return verdictCssVar(scoreToVerdict(score).colorToken);
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
