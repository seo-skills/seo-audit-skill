/**
 * The All checks filter: All | Failed | Warnings | Passed | Not measured,
 * each with its status shape, the active one in ink (DESIGN.md).
 */

import { StatusShape, type StatusKind } from './Status.js';

export type FilterStatus = 'all' | 'fail' | 'warn' | 'pass' | 'notmeasured';

interface FilterTabsProps {
  active: FilterStatus;
  counts: { all: number; fail: number; warn: number; pass: number; notmeasured: number };
  onChange: (status: FilterStatus) => void;
}

const FILTERS: { key: FilterStatus; label: string; shape?: StatusKind }[] = [
  { key: 'all', label: 'All' },
  { key: 'fail', label: 'Failed', shape: 'fail' },
  { key: 'warn', label: 'Warnings', shape: 'warn' },
  { key: 'pass', label: 'Passed', shape: 'pass' },
  { key: 'notmeasured', label: 'Not measured', shape: 'not-measured' },
];

/**
 * A segmented control, ink when active (DESIGN.md): the status words carry the
 * meaning, so the tabs do not need to be red, amber and green to be read.
 */
export function FilterTabs({ active, counts, onChange }: FilterTabsProps) {
  return (
    <div className="segmented flex-wrap" role="group" aria-label="Filter checks">
      {FILTERS.filter(({ key }) => key !== 'notmeasured' || counts.notmeasured > 0).map(({ key, label, shape }) => (
        <button
          key={key}
          type="button"
          aria-pressed={active === key}
          onClick={() => onChange(key)}
          className={`segment gap-1.5 ${active === key ? 'segment-active' : ''}`}
        >
          {shape && (
            <span className="status" aria-hidden="true">
              <StatusShape status={shape} />
            </span>
          )}
          {label}
          <span className="figure opacity-70">{counts[key].toLocaleString()}</span>
        </button>
      ))}
    </div>
  );
}
