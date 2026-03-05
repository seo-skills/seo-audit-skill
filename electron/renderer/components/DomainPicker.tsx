/**
 * Dropdown for selecting an audited domain from history.
 */

interface DomainPickerProps {
  domains: string[];
  selected: string | null;
  onChange: (domain: string | null) => void;
}

export function DomainPicker({ domains, selected, onChange }: DomainPickerProps) {
  return (
    <select
      value={selected ?? ''}
      onChange={(e) => onChange(e.target.value || null)}
      className="px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] text-sm focus:outline-none focus:border-[var(--color-accent)]"
      style={{ color: 'var(--color-text)' }}
    >
      <option value="">All domains</option>
      {domains.map((domain) => (
        <option key={domain} value={domain}>
          {domain}
        </option>
      ))}
    </select>
  );
}
