/**
 * The wording of "what to fix first", shared by the dashboard, the desktop app
 * and the HTML report so the three can never phrase it differently: the fix
 * text split into a headline, the points format, the cap headlines, and the
 * agent's one sentence (DESIGN.md "The agent in the product").
 *
 * Pure and dependency-free: `ui/` imports it as it imports `coverage-line.ts`.
 */

/** What the wording needs to know about a fix */
export interface PointedFix {
  points: number;
}

/** What the wording needs to know about the audit */
export interface FixBriefAudit {
  crawledPages: number;
  scoreCap?: unknown;
}

/**
 * Split a rule's fix text into a headline and the rest.
 *
 * "Reduce DOM size: remove unused elements, use virtualization" becomes
 * "Reduce DOM size" and "Remove unused elements, use virtualization". Every
 * rule's fix text is imperative, so the headline reads as an instruction.
 */
export function splitFix(fix: string): { headline: string; rest: string } {
  const text = fix.trim().replace(/\.$/, '');
  const match = /^(.+?)[:;]\s+(.+)$/.exec(text);
  if (!match) return { headline: text, rest: '' };
  const rest = match[2]!.replace(/\.$/, '');
  return { headline: match[1]!, rest: rest.charAt(0).toUpperCase() + rest.slice(1) };
}

/** What the score is missing: every fix's points added up */
export function missingPoints(fixes: readonly PointedFix[]): number {
  return fixes.reduce((sum, fix) => sum + fix.points, 0);
}

/** "+0.6", or "+<0.1" for a fix too small to show at one decimal */
export function formatPoints(points: number): string {
  if (points > 0 && points < 0.05) return '+<0.1';
  return `+${points.toFixed(1)}`;
}

/** Two fixes worth the same, as the report rounds them */
export function tied(a: PointedFix | undefined, b: PointedFix | undefined): boolean {
  return Boolean(a && b && formatPoints(a.points) === formatPoints(b.points));
}

/** The fix that lifts a page-level cap, said where the score names the cap */
const CAP_HEADLINES: Record<string, string> = {
  noindex: 'Remove the noindex directive',
  'robots-disallowed': 'Let Googlebot fetch this page',
  'empty-page': 'Give the page a title and content',
  'thin-content': 'Add main content to the page',
  'no-title': 'Add a <title>',
};

export function capHeadline(capId: string): string {
  return CAP_HEADLINES[capId] ?? 'Lift the score cap';
}

/**
 * The agent's one sentence over the fix queue.
 *
 * It speaks about the queue as a whole, never as a pitch for one fix, and may
 * only say what the numbers support: "more than the next four together" is
 * printed when it is true and never as a slogan.
 */
export function agentLine(fixes: readonly PointedFix[], result: FixBriefAudit): string {
  const where = result.crawledPages > 1 ? 'this site' : 'this page';
  if (result.scoreCap) return 'Lift the score cap first. Nothing in this queue moves the score until it is gone.';
  if (fixes.length === 0) return 'Nothing to fix in what we measured.';

  const missing = missingPoints(fixes).toFixed(1);
  const [lead, ...rest] = fixes;
  const nextFour = rest.slice(0, 4).reduce((sum, fix) => sum + fix.points, 0);
  if (rest.length >= 4 && lead!.points > nextFour) {
    return `Work from the top. 01 alone returns more than the next four together, of the ${missing} points ${where} is missing.`;
  }
  if (fixes.length <= 5) {
    return fixes.length === 1
      ? `One fix left, worth all ${missing} missing points.`
      : `These ${fixes.length} fixes return all ${missing} points ${where} is missing.`;
  }
  const topFive = fixes.slice(0, 5).reduce((sum, fix) => sum + fix.points, 0).toFixed(1);
  return `Work from the top. The first five return ${topFive} of the ${missing} points ${where} is missing.`;
}

/** Where a grade starts; the verdict reads the rounded score (`verdict.ts`) */
const GRADE_STEPS: ReadonlyArray<{ min: number; label: string }> = [
  { min: 50, label: 'Needs Work' },
  { min: 70, label: 'Fair' },
  { min: 80, label: 'Good' },
  { min: 90, label: 'Excellent' },
];

export interface NextGrade {
  /** The grade above the current one, or null at the top grade */
  label: string | null;
  /** Score points to reach it, measured on the exact score */
  gap: number;
  /** How many fixes from the top of the queue cover the gap */
  fixes: number;
}

/**
 * How far the next grade is, in the fix queue's own terms.
 *
 * The grade is read from the rounded score, so 89.5 is already Excellent: the
 * gap is to the threshold minus half a point, not to the threshold. The fixes
 * count is the shortest run from the top of the queue that covers the gap.
 *
 * @param exact - The score before rounding (100 minus every fix's points)
 * @param ranked - Fixes in queue order
 */
export function nextGrade(exact: number, ranked: readonly PointedFix[]): NextGrade {
  const next = GRADE_STEPS.find((step) => Math.round(exact) < step.min);
  if (!next) return { label: null, gap: Math.max(0, 100 - exact), fixes: ranked.length };
  const gap = Math.max(0, next.min - 0.5 - exact);
  let covered = 0;
  let fixes = 0;
  for (const fix of ranked) {
    if (covered >= gap) break;
    covered += fix.points;
    fixes++;
  }
  return { label: next.label, gap, fixes };
}

/** The line under the score that says what the next grade costs */
export function nextGradeLine(exact: number, ranked: readonly PointedFix[]): string {
  const step = nextGrade(exact, ranked);
  if (step.label === null) {
    return step.gap < 0.05 ? 'Top grade, nothing left to fix.' : `Top grade. ${step.gap.toFixed(1)} points left to 100.`;
  }
  const points = step.gap < 0.05 ? 'Under 0.1 points' : `${step.gap.toFixed(1)} points`;
  const who = step.fixes <= 1 ? 'the first fix gets you there' : `the first ${step.fixes} fixes get you there`;
  return `${points} to ${step.label}: ${who}.`;
}
