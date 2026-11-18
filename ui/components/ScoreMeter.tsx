/**
 * A score as a measured bar, not a dial (DESIGN.md, R3).
 *
 * The filled part is the score, in ink at 80 and above, amber below, red under
 * 70; the hatched rest is what it is missing — the same hatch the points strip
 * uses for lost points. The large meter marks where each grade starts (50, 70,
 * 80, 90), so a reader sees how far the next grade is without doing sums.
 *
 * It fills once, and only on the arrival from a run (the report's one authored
 * moment); every other time it is simply there, because a report is opened
 * many times a day and a bar that animates on each visit is a bar that makes
 * the reader wait.
 */

import { useEffect, useState } from 'react';
import { getScoreColor } from '../lib/format.js';

const GRADE_TICKS = [50, 70, 80, 90] as const;

interface ScoreMeterProps {
  /** 0–100; the exact score where there is one, so the bar is not rounded twice */
  value: number;
  /** The rounded score the colour and grade are read from */
  score: number;
  size?: 'lg' | 'sm';
  /** Fill from empty once on mount (the arrival from a run) */
  animate?: boolean;
  label?: string;
}

export function ScoreMeter({ value, score, size = 'sm', animate = false, label }: ScoreMeterProps) {
  const fraction = Math.min(1, Math.max(0, value / 100));
  const [shown, setShown] = useState(animate ? 0 : fraction);
  useEffect(() => {
    if (!animate) return setShown(fraction);
    const frame = requestAnimationFrame(() => setShown(fraction));
    return () => cancelAnimationFrame(frame);
  }, [animate, fraction]);

  const fill = (
    <span
      className="absolute inset-y-0 left-0 w-full origin-left"
      style={{
        backgroundColor: getScoreColor(score),
        transform: `scaleX(${shown})`,
        transition: animate ? 'transform 600ms cubic-bezier(0.23, 1, 0.32, 1)' : undefined,
      }}
    />
  );

  if (size === 'sm') {
    return (
      <span
        role="img"
        aria-label={label ?? `Score ${score} of 100`}
        className="meter-track relative inline-block w-12 h-1 overflow-hidden align-middle"
      >
        {fill}
      </span>
    );
  }

  return (
    <div role="img" aria-label={label ?? `Score ${score} of 100`} className="w-full">
      <div className="meter-track is-hatched relative h-2 overflow-hidden">
        {fill}
        {GRADE_TICKS.map((tick) => (
          // A notch in the page colour where each grade starts
          <span
            key={tick}
            aria-hidden="true"
            className="absolute inset-y-0 w-[2px] -translate-x-1/2 bg-[var(--color-bg)]"
            style={{ left: `${tick}%` }}
          />
        ))}
      </div>
      <div aria-hidden="true" className="relative h-4 mt-1 figure text-[10px] leading-4 text-[var(--color-text-muted)]">
        {/* Only where grades start: 0 and 100 are implied, and 100 collided with 90 */}
        {GRADE_TICKS.map((tick) => (
          <span key={tick} className="absolute -translate-x-1/2" style={{ left: `${tick}%` }}>
            {tick}
          </span>
        ))}
      </div>
    </div>
  );
}
