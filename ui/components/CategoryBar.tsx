/**
 * Horizontal progress bar for a single category score.
 */

import { getScoreColor } from '../lib/format.js';

interface CategoryBarProps {
  name: string;
  score: number;
  passCount: number;
  warnCount: number;
  failCount: number;
  onClick?: () => void;
  active?: boolean;
}

export function CategoryBar({
  name,
  score,
  passCount,
  warnCount,
  failCount,
  onClick,
  active,
}: CategoryBarProps) {
  const color = getScoreColor(score);

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-3 rounded-lg border transition-colors ${
        active
          ? 'border-[var(--color-accent)] bg-[var(--color-accent-light)]'
          : 'border-[var(--color-border-subtle)] hover:bg-[var(--color-bg-hover)]'
      }`}
    >
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
          {name}
        </span>
        <span className="text-sm font-bold" style={{ color }}>
          {Math.round(score)}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-[var(--color-border)]">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${score}%`, backgroundColor: color }}
        />
      </div>
      <div className="flex gap-3 mt-1.5 text-xs" style={{ color: 'var(--color-text-muted)' }}>
        {failCount > 0 && (
          <span style={{ color: 'var(--color-fail)' }}>{failCount} fail</span>
        )}
        {warnCount > 0 && (
          <span style={{ color: 'var(--color-warn)' }}>{warnCount} warn</span>
        )}
        <span style={{ color: 'var(--color-pass)' }}>{passCount} pass</span>
      </div>
    </button>
  );
}
