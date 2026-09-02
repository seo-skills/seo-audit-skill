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
  notMeasuredCount?: number;
}

export function ScoreStats({
  passCount,
  warnCount,
  failCount,
  notMeasuredCount = 0,
}: ScoreStatsProps) {
  return (
    <div className="flex gap-4">
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
