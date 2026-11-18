/**
 * "Did you mean …?" for names typed into config and on the command line.
 *
 * A typo'd rule id in `[rules.override]` used to be silently ignored, which
 * for a `fail_ci` entry means a CI gate that never fires. Rejecting the typo
 * is half the fix; naming the id the user meant is the other half.
 */

/** Edit distance between two strings (insert, delete, substitute) */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + cost);
    }
    previous = current;
  }
  return previous[b.length];
}

/**
 * The candidates closest to `input`, best first.
 *
 * Only candidates within a sixth of the input's length are offered, and only
 * those as close as the best match (or one edit further): past that the
 * "suggestion" is noise, and three guesses where one was meant is worse than
 * one. A candidate that contains the input (or the other way round) always
 * qualifies, so `canonical-present` finds `core-canonical-present`.
 */
export function suggestClosest(input: string, candidates: readonly string[], limit = 3): string[] {
  const needle = input.toLowerCase();
  const budget = Math.max(2, Math.ceil(needle.length / 6));

  const scored = candidates
    .map((candidate) => {
      const lower = candidate.toLowerCase();
      const contains = lower.includes(needle) || needle.includes(lower);
      return { candidate, distance: contains ? 0.5 : editDistance(needle, lower) };
    })
    .filter(({ distance }) => distance <= budget)
    .sort((a, b) => a.distance - b.distance || a.candidate.localeCompare(b.candidate));

  if (scored.length === 0) return [];
  const best = scored[0].distance;
  return scored
    .filter(({ distance }) => distance <= best + 1)
    .slice(0, limit)
    .map(({ candidate }) => candidate);
}

/** ` Did you mean x or y?`, or an empty string when nothing is close */
export function didYouMean(input: string, candidates: readonly string[]): string {
  const close = suggestClosest(input, candidates);
  if (close.length === 0) return '';
  const quoted = close.map((c) => `"${c}"`);
  const list = quoted.length === 1 ? quoted[0] : `${quoted.slice(0, -1).join(', ')} or ${quoted[quoted.length - 1]}`;
  return ` Did you mean ${list}?`;
}
