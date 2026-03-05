/**
 * Recharts LineChart showing score trend over time.
 */

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { ScoreTrendPoint } from '../../shared/ipc-types.js';

interface ScoreTrendProps {
  data: ScoreTrendPoint[];
}

export function ScoreTrend({ data }: ScoreTrendProps) {
  if (data.length < 2) {
    return (
      <div className="text-center py-8 text-sm" style={{ color: 'var(--color-text-muted)' }}>
        Run at least 2 audits to see a trend chart
      </div>
    );
  }

  const chartData = data
    .map((d) => ({
      date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      score: d.score,
    }))
    .reverse(); // Oldest first

  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
          axisLine={{ stroke: 'var(--color-border)' }}
          tickLine={false}
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
          axisLine={{ stroke: 'var(--color-border)' }}
          tickLine={false}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'var(--color-bg-elevated)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            fontSize: 12,
          }}
          labelStyle={{ color: 'var(--color-text-secondary)' }}
        />
        <Line
          type="monotone"
          dataKey="score"
          stroke="var(--color-accent)"
          strokeWidth={2}
          dot={{ r: 4, fill: 'var(--color-accent)' }}
          activeDot={{ r: 6, fill: 'var(--color-accent)' }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
