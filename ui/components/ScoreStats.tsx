/**
 * The counters that account for every rule in the audit: failures, warnings,
 * passed, and the checks that took no reading.
 *
 * Not-measured is shown whenever there is one. Leaving it out made the three
 * counters silently fall short of the rule total — 219 + 34 + 24 against 332 —
 * with nothing to say the remaining 55 were checks that never ran rather than
 * checks that passed.
 */

interface ScoreStatsProps {
  passCount: number;
  warnCount: number;
  failCount: number;
  /** Checks that took no reading for a reason worth acting on */
  notMeasuredCount?: number;
  /** Checks for a pattern the page does not use: a quiet second line */
  notApplicableCount?: number;
  /** Findings reported but not counted in the score yet */
  advisoryCount?: number;
}

export function ScoreStats({
  passCount,
  warnCount,
  failCount,
  notMeasuredCount = 0,
  notApplicableCount = 0,
  advisoryCount = 0,
}: ScoreStatsProps) {
  const quiet = [
    advisoryCount > 0 && `${advisoryCount} advisory finding${advisoryCount === 1 ? '' : 's'}, not counted in the score yet`,
    notApplicableCount > 0 && `${notApplicableCount} check${notApplicableCount === 1 ? '' : 's'} did not apply`,
  ].filter(Boolean);
  return (
    <div className="space-y-1.5">
    {/* Four counters do not fit across a phone; without wrapping, "Not
        measured" painted outside the viewport where nobody could read it. */}
    <div className="flex flex-wrap gap-x-4 gap-y-2">
      <StatBadge count={failCount} label="Failed" colorVar="--color-fail" bgVar="--color-fail-bg" />
      <StatBadge count={warnCount} label="Warnings" colorVar="--color-warn" bgVar="--color-warn-bg" />
      <StatBadge count={passCount} label="Passed" colorVar="--color-pass" bgVar="--color-pass-bg" />
      {notMeasuredCount > 0 && (
        <StatBadge
          count={notMeasuredCount}
          label="Not measured"
          colorVar="--color-text-secondary"
          bgVar="--color-bg-active"
        />
      )}
    </div>
    {quiet.length > 0 && (
      <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
        {quiet.join(' · ')}
      </p>
    )}
    </div>
  );
}

function StatBadge({
  count,
  label,
  colorVar,
  bgVar,
}: {
  count: number;
  label: string;
  colorVar: string;
  bgVar: string;
}) {
  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
      style={{ backgroundColor: `var(${bgVar})` }}
    >
      <span className="text-lg font-bold" style={{ color: `var(${colorVar})` }}>
        {count}
      </span>
      <span className="text-xs" style={{ color: `var(${colorVar})` }}>
        {label}
      </span>
    </div>
  );
}
