/**
 * One row per audited domain: latest score, how it moved, a sparkline.
 *
 * This is the answer to "what happened to my sites?" without opening any of
 * them, which is the reason the dashboard exists at all.
 */

import { useState } from 'react';
import type { DomainSummary } from '../../electron/shared/ipc-types.js';
import { getScoreColor } from '../lib/format.js';

/**
 * How many sites show before the rest are folded away.
 *
 * The strip used to be one horizontally scrolling row. On macOS the scrollbar
 * is an overlay that appears only while scrolling, so with seven sites the only
 * standing cue that more existed was a card clipped mid-edge — and reaching
 * them needed shift+wheel. 279px of navigation was hidden at 1440px wide and
 * 1089px (76%) on a phone.
 *
 * Wrapping fixes the hiding; it does not fix the growth, because every site
 * ever audited joins this row permanently. So it wraps *and* stops, and the
 * remainder is one click away rather than one undiscoverable gesture.
 */
const VISIBLE_DOMAINS = 6;

interface DomainStripProps {
  domains: DomainSummary[];
  selected: string | null;
  onSelect: (domain: string | null) => void;
}

/** A sparkline small enough to sit inside a button */
function Sparkline({ scores }: { scores: number[] }) {
  if (scores.length < 2) return null;
  const width = 56;
  const height = 18;
  const min = Math.min(...scores, 0);
  const max = Math.max(...scores, 100);
  const span = max - min || 1;
  const points = scores
    .map((score, index) => {
      const x = (index / (scores.length - 1)) * width;
      const y = height - ((score - min) / span) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <svg width={width} height={height} aria-hidden="true" className="shrink-0">
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.7" />
    </svg>
  );
}

function Delta({ value }: { value: number | null }) {
  if (value === null) return <span style={{ color: 'var(--color-text-muted)' }}>first audit</span>;
  if (value === 0) return <span style={{ color: 'var(--color-text-muted)' }}>no change</span>;
  const up = value > 0;
  return (
    <span style={{ color: up ? 'var(--color-pass)' : 'var(--color-fail)' }}>
      {up ? '▲' : '▼'} {Math.abs(value)}
    </span>
  );
}

export function DomainStrip({ domains, selected, onSelect }: DomainStripProps) {
  const [showAll, setShowAll] = useState(false);

  // The selected site is always shown, even when it sits past the cap —
  // otherwise picking a site from the full list would make it disappear.
  const selectedIndex = domains.findIndex((d) => d.domain === selected);
  const cap = showAll
    ? domains.length
    : Math.max(VISIBLE_DOMAINS, selectedIndex + 1);
  const shown = domains.slice(0, cap);
  const hidden = domains.length - shown.length;

  if (domains.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 pb-1" role="group" aria-label="Audited sites">
      <button
        type="button"
        onClick={() => onSelect(null)}
        className="shrink-0 px-3 py-2 rounded-lg border text-sm transition-colors"
        style={{
          borderColor: selected === null ? 'var(--color-accent)' : 'var(--color-border)',
          color: selected === null ? 'var(--color-accent)' : 'var(--color-text-secondary)',
          backgroundColor: selected === null ? 'var(--color-accent-light)' : 'transparent',
        }}
        aria-pressed={selected === null}
      >
        All sites
      </button>

      {shown.map((domain) => {
        const active = selected === domain.domain;
        return (
          <button
            key={domain.domain}
            type="button"
            onClick={() => onSelect(domain.domain)}
            aria-pressed={active}
            className="shrink-0 px-3 py-2 rounded-lg border text-left transition-colors"
            style={{
              borderColor: active ? 'var(--color-accent)' : 'var(--color-border)',
              backgroundColor: active ? 'var(--color-accent-light)' : 'transparent',
            }}
          >
            <div className="flex items-center gap-3">
              <div>
                <div className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                  {domain.domain}
                </div>
                <div className="text-xs flex items-center gap-2" style={{ color: 'var(--color-text-muted)' }}>
                  <span>{domain.auditCount} {domain.auditCount === 1 ? 'audit' : 'audits'}</span>
                  <Delta value={domain.scoreDelta} />
                </div>
              </div>
              <div className="flex items-center gap-2" style={{ color: getScoreColor(domain.latest.overallScore) }}>
                <Sparkline scores={domain.sparkline} />
                <span className="text-lg font-semibold tabular-nums">{domain.latest.overallScore}</span>
              </div>
            </div>
          </button>
        );
      })}

      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="shrink-0 px-3 py-2 rounded-lg border border-dashed text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
          style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
        >
          {hidden} more {hidden === 1 ? 'site' : 'sites'}
        </button>
      )}

      {showAll && domains.length > VISIBLE_DOMAINS && (
        <button
          type="button"
          onClick={() => setShowAll(false)}
          className="shrink-0 px-3 py-2 rounded-lg border border-dashed text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
          style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
        >
          Show fewer
        </button>
      )}
    </div>
  );
}
