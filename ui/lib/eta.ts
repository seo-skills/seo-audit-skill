/**
 * How long a run has taken, and how long is left.
 *
 * An audit of eight pages takes about four and a half minutes and the UI said
 * nothing about time at all, so there was no way to tell a slow run from a
 * stuck one.
 *
 * Elapsed is a fact and is always shown. A projection is a guess, and a wrong
 * one is worse than none — a countdown that stalls or runs backwards reads as a
 * broken tool. So it appears only when the numbers behind it are real:
 *
 * - measured from the first completed page, not from the run's start, because
 *   the crawl and the browser launch are one-off costs that would inflate every
 *   remaining page;
 * - over at least two completed pages, so it is a rate and not a single sample;
 * - never during the crawl, where page count is still being discovered and the
 *   denominator is not yet known;
 * - across completed pages only. Dividing by the current time instead makes the
 *   rate climb for as long as a page is in flight, so the projection counts
 *   *up* between completions. Measured on a real four-page crawl that read
 *   "76s left", then 86, 97, 107, 117, 127 — while nothing was wrong.
 * - and it is withdrawn rather than floored at zero: once a run is past its own
 *   estimate the estimate was wrong, and "0s left" on a run still going is a
 *   worse answer than not saying.
 */

export interface RunTiming {
  /** Whole seconds since the run started */
  elapsedSeconds: number;
  /** Seconds remaining, or null when no honest projection can be made */
  remainingSeconds: number | null;
}

export interface TimingInput {
  startedAt: string | null;
  firstPageAt: string | null;
  lastPageAt: string | null;
  completed: number;
  total: number;
  crawling: boolean;
  /** Injected so tests are not at the mercy of the clock */
  now?: number;
}

export function runTiming({
  startedAt,
  firstPageAt,
  lastPageAt,
  completed,
  total,
  crawling,
  now = Date.now(),
}: TimingInput): RunTiming {
  const started = startedAt ? Date.parse(startedAt) : NaN;
  const elapsedSeconds = Number.isFinite(started) ? Math.max(0, Math.floor((now - started) / 1000)) : 0;

  const first = firstPageAt ? Date.parse(firstPageAt) : NaN;
  const last = lastPageAt ? Date.parse(lastPageAt) : NaN;
  const remaining = total - completed;

  // `completed - 1` pages have finished since the first one was stamped; fewer
  // than two completions is a sample, not a rate.
  const measured = completed - 1;
  if (crawling || !Number.isFinite(first) || !Number.isFinite(last) || measured < 1 || remaining <= 0) {
    return { elapsedSeconds, remainingSeconds: null };
  }

  // Between two completions, not up to the current moment.
  const perPage = (last - first) / measured;
  if (!Number.isFinite(perPage) || perPage <= 0) {
    return { elapsedSeconds, remainingSeconds: null };
  }

  // The page in flight is already partway through, so its elapsed share comes
  // off the total. This is what makes the number fall between events.
  const projected = remaining * perPage - (now - last);
  if (projected <= 0) {
    // Past its own estimate: the estimate was wrong, so there isn't one.
    return { elapsedSeconds, remainingSeconds: null };
  }

  return { elapsedSeconds, remainingSeconds: Math.round(projected / 1000) };
}

/**
 * Duration as a person would say it.
 *
 * Seconds below a minute, then minutes, because "247s" makes a reader do
 * arithmetic to learn something the tool already knows.
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.max(0, Math.round(seconds))}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);
  if (minutes < 60) return rest === 0 ? `${minutes}m` : `${minutes}m ${rest}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}
