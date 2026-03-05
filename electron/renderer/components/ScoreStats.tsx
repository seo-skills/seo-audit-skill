/**
 * Three colored counters: failures, warnings, passed.
 */

interface ScoreStatsProps {
  passCount: number;
  warnCount: number;
  failCount: number;
}

export function ScoreStats({ passCount, warnCount, failCount }: ScoreStatsProps) {
  return (
    <div className="flex gap-4">
      <StatBadge count={failCount} label="Failed" colorVar="--color-fail" bgVar="--color-fail-bg" />
      <StatBadge count={warnCount} label="Warnings" colorVar="--color-warn" bgVar="--color-warn-bg" />
      <StatBadge count={passCount} label="Passed" colorVar="--color-pass" bgVar="--color-pass-bg" />
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
