/**
 * Score history as a hand-drawn SVG line.
 *
 * Recharts was 350 kB for one chart of at most twenty points. This is the
 * chart, in the page's own tokens, with no dependency.
 */

import { useId } from 'react';
import type { ScoreTrendPointDto } from '../../electron/shared/ipc-types.js';

interface TrendChartProps {
  points: ScoreTrendPointDto[];
  height?: number;
  /** Called when a point is activated, so the chart can navigate */
  onSelect?: (auditId: string) => void;
}

const PADDING = { top: 12, right: 12, bottom: 22, left: 30 };

/**
 * The fewest points that can show a direction rather than assert one.
 * The threshold lives here alone: a page that repeats it hides the section and
 * with it the message explaining why there is no trend yet.
 */
export const MIN_TREND_POINTS = 3;

export function TrendChart({ points, height = 160, onSelect }: TrendChartProps) {
  const gradientId = useId();

  // Two points draw a straight segment between them, which reads as a trend
  // while being a single comparison — and the direction of that one line is
  // exactly what a reader takes away. Three is the fewest that can show a shape.
  if (points.length < MIN_TREND_POINTS) {
    const remaining = MIN_TREND_POINTS - points.length;
    return (
      <p className="text-sm py-6 text-center" style={{ color: 'var(--color-text-muted)' }}>
        {points.length === 0
          ? 'No audits of this site yet.'
          : `${remaining} more ${remaining === 1 ? 'audit' : 'audits'} of this site and the trend will mean something.`}
      </p>
    );
  }

  // A fixed viewBox with preserveAspectRatio="none" would distort the stroke,
  // so the chart draws in a 600-wide coordinate space and scales as a whole.
  const width = 600;
  const plotWidth = width - PADDING.left - PADDING.right;
  const plotHeight = height - PADDING.top - PADDING.bottom;

  const x = (index: number) => PADDING.left + (index / (points.length - 1)) * plotWidth;
  const y = (score: number) => PADDING.top + (1 - score / 100) * plotHeight;

  const line = points.map((point, index) => `${x(index)},${y(point.score)}`).join(' ');
  const area = `${PADDING.left},${PADDING.top + plotHeight} ${line} ${x(points.length - 1)},${PADDING.top + plotHeight}`;

  // A point audited by a different engine version is marked: a score that
  // moved because the rules changed is not a score that moved because the
  // site changed.
  const engineChangedAt = new Set<number>();
  points.forEach((point, index) => {
    const previous = points[index - 1];
    if (previous && point.engineVersion && previous.engineVersion && point.engineVersion !== previous.engineVersion) {
      engineChangedAt.add(index);
    }
  });

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full"
      style={{ height }}
      role="img"
      aria-label={`Score history: ${points.map((p) => p.score).join(', ')}`}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.18" />
          <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0" />
        </linearGradient>
      </defs>

      {[0, 50, 100].map((score) => (
        <g key={score}>
          <line
            x1={PADDING.left}
            y1={y(score)}
            x2={width - PADDING.right}
            y2={y(score)}
            stroke="var(--color-border)"
            strokeWidth="1"
          />
          <text
            x={PADDING.left - 6}
            y={y(score) + 4}
            textAnchor="end"
            fontSize="11"
            fill="var(--color-text-muted)"
          >
            {score}
          </text>
        </g>
      ))}

      <polygon points={area} fill={`url(#${gradientId})`} />
      <polyline
        points={line}
        fill="none"
        stroke="var(--color-accent)"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {points.map((point, index) => (
        <g key={point.auditId}>
          {engineChangedAt.has(index) && (
            <line
              x1={x(index)}
              y1={PADDING.top}
              x2={x(index)}
              y2={PADDING.top + plotHeight}
              stroke="var(--color-warn)"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
          )}
          <circle
            cx={x(index)}
            cy={y(point.score)}
            r="4"
            fill="var(--color-bg-elevated)"
            stroke="var(--color-accent)"
            strokeWidth="2"
            style={onSelect ? { cursor: 'pointer' } : undefined}
            onClick={onSelect ? () => onSelect(point.auditId) : undefined}
          >
            <title>
              {`${point.score}/100 · ${new Date(point.date).toLocaleString()}`}
              {engineChangedAt.has(index) ? ` · engine ${point.engineVersion}` : ''}
            </title>
          </circle>
        </g>
      ))}
    </svg>
  );
}
