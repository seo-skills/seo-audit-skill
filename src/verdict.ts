/**
 * One score, one verdict.
 *
 * Before this existed the product graded the same audit three different ways: a
 * score of 55 was **D** in the terminal (`banner.ts`, D at ≥50), **F** in the
 * report handed to an LLM (`llm-reporter.ts`, D at ≥60), and "Needs Work" in
 * the HTML report and dashboard — which used a fourth set of boundaries again
 * for its colours. Colour drift is cosmetic; grade drift is the product
 * disagreeing with itself about its own answer.
 *
 * Every surface derives its verdict here. The buckets are the terminal's,
 * because the terminal is the default output.
 */

/** The colour a verdict is drawn in, as a design-token name */
export type VerdictToken = 'pass' | 'warn' | 'orange' | 'fail' | 'neutral';

export interface Verdict {
  /** Letter grade, printed by the terminal and the machine reporters */
  grade: 'A' | 'B' | 'C' | 'D' | 'F' | '—';
  /** Word label, printed by the visual surfaces */
  label: string;
  /** Design token to colour it with; never a literal */
  colorToken: VerdictToken;
}

/**
 * Five buckets, one boundary set.
 *
 * The letters were already five (90/80/70/50) and the labels were four
 * (90/70/50), so unifying them needs a fifth word: 70–79 becomes "Fair", which
 * used to read "Good". That is a visible change to every dashboard card in that
 * band, and it is deliberate.
 */
const BUCKETS: ReadonlyArray<{ min: number } & Verdict> = [
  { min: 90, grade: 'A', label: 'Excellent', colorToken: 'pass' },
  { min: 80, grade: 'B', label: 'Good', colorToken: 'pass' },
  { min: 70, grade: 'C', label: 'Fair', colorToken: 'warn' },
  { min: 50, grade: 'D', label: 'Needs Work', colorToken: 'orange' },
  { min: -Infinity, grade: 'F', label: 'Poor', colorToken: 'fail' },
];

/**
 * "Nothing could be scored" is not the same as "scored zero".
 *
 * `calculateOverallScore()` returns 0 when the total weight is 0 — an audit
 * where every check went unmeasured. Grading that F would tell the user their
 * site is catastrophic when the truth is that nothing ran.
 */
const NOT_SCORED: Verdict = { grade: '—', label: 'Not scored', colorToken: 'neutral' };

/**
 * The verdict for a score.
 *
 * @param score - 0–100, or null when nothing could be measured
 */
export function scoreToVerdict(score: number | null | undefined): Verdict {
  if (score === null || score === undefined || Number.isNaN(score)) return NOT_SCORED;

  for (const bucket of BUCKETS) {
    if (score >= bucket.min) {
      return { grade: bucket.grade, label: bucket.label, colorToken: bucket.colorToken };
    }
  }
  return NOT_SCORED;
}

/** The CSS custom property a verdict token maps to */
export function verdictCssVar(token: VerdictToken): string {
  return `var(--color-${token})`;
}

/**
 * The CSS custom properties a verdict is drawn with.
 *
 * Callers used to build the tint themselves with `` `${color}15` `` — string
 * concatenation onto `var(--color-pass)`, which yields `var(--color-pass)15`.
 * That is not a colour, so the browser dropped it: the score label rendered
 * with no background at all, at 2.5:1 against the card, in the highest-priority
 * element on the page. A token audit could not have caught it, because the
 * token values were right and the composition was not.
 */
export function verdictStyle(score: number | null | undefined): {
  color: string;
  backgroundColor: string;
} {
  const { colorToken } = scoreToVerdict(score);
  return {
    color: `var(--color-${colorToken})`,
    backgroundColor: `var(--color-${colorToken}-bg)`,
  };
}
