/**
 * SVG radial gauge for displaying audit scores.
 * Ported from the html-reporter.ts SVG score circle.
 */

import { getScoreColor, getScoreLabel } from '../lib/format.js';

interface ScoreCircleProps {
  score: number;
  size?: number;
}

export function ScoreCircle({ score, size = 140 }: ScoreCircleProps) {
  const radius = (size / 2) - 12;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (score / 100) * circumference;
  const color = getScoreColor(score);
  const label = getScoreLabel(score);

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-border)"
          strokeWidth="8"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          className="transition-all duration-1000 ease-out"
        />
        <text
          x={size / 2}
          y={size / 2}
          textAnchor="middle"
          dominantBaseline="central"
          className="transform rotate-90 origin-center"
          fill="var(--color-text)"
          fontSize={size * 0.28}
          fontWeight="700"
          fontFamily="var(--font-sans)"
        >
          {Math.round(score)}
        </text>
      </svg>
      <span
        className="text-sm font-semibold px-3 py-0.5 rounded-full"
        style={{ color, backgroundColor: `${color}15` }}
      >
        {label}
      </span>
    </div>
  );
}
