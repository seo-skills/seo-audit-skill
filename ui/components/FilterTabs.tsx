/**
 * Filter pill buttons: All | Failures | Warnings | Passed
 */

export type FilterStatus = 'all' | 'fail' | 'warn' | 'pass';

interface FilterTabsProps {
  active: FilterStatus;
  counts: { all: number; fail: number; warn: number; pass: number };
  onChange: (status: FilterStatus) => void;
}

const FILTERS: { key: FilterStatus; label: string; color?: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'fail', label: 'Failed', color: 'var(--color-fail)' },
  { key: 'warn', label: 'Warnings', color: 'var(--color-warn)' },
  { key: 'pass', label: 'Passed', color: 'var(--color-pass)' },
];

export function FilterTabs({ active, counts, onChange }: FilterTabsProps) {
  return (
    <div className="flex gap-2">
      {FILTERS.map(({ key, label, color }) => {
        const isActive = active === key;
        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              isActive
                ? 'text-white'
                : 'hover:bg-[var(--color-bg-hover)]'
            }`}
            style={{
              backgroundColor: isActive ? (color ?? 'var(--color-accent)') : undefined,
              color: isActive ? '#fff' : (color ?? 'var(--color-text-secondary)'),
            }}
          >
            {label}
            <span className="ml-1.5 opacity-80">{counts[key]}</span>
          </button>
        );
      })}
    </div>
  );
}
