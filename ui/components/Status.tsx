/**
 * A result's status as DESIGN.md draws it: a 10px shape first, colour only on
 * the shape, and always beside its word, so the state reads without colour.
 *
 * fails ■ filled · warning ◧ half-filled · passes □ open ·
 * not measured ⬚ dashed · advisory ○ circle
 */

export type StatusKind = 'fail' | 'warn' | 'pass' | 'not-measured' | 'advisory';

const WORDS: Record<StatusKind, string> = {
  fail: 'Fails',
  warn: 'Warning',
  pass: 'Passes',
  'not-measured': 'Not measured',
  advisory: 'Advisory',
};

export function StatusShape({ status }: { status: StatusKind }) {
  switch (status) {
    case 'fail':
      return (
        <svg viewBox="0 0 10 10" aria-hidden="true">
          <rect x="0.5" y="0.5" width="9" height="9" fill="var(--color-fail)" stroke="var(--color-fail)" />
        </svg>
      );
    case 'warn':
      return (
        <svg viewBox="0 0 10 10" aria-hidden="true">
          <rect x="0.5" y="0.5" width="9" height="9" fill="none" stroke="var(--color-warn)" />
          <rect x="0.5" y="5" width="9" height="4.5" fill="var(--color-warn)" />
        </svg>
      );
    case 'pass':
      return (
        <svg viewBox="0 0 10 10" aria-hidden="true">
          <rect x="0.5" y="0.5" width="9" height="9" fill="none" stroke="var(--color-text-muted)" />
        </svg>
      );
    case 'not-measured':
      return (
        <svg viewBox="0 0 10 10" aria-hidden="true">
          <rect x="0.5" y="0.5" width="9" height="9" fill="none" stroke="var(--color-text-muted)" strokeDasharray="2 1.5" />
        </svg>
      );
    case 'advisory':
      return (
        <svg viewBox="0 0 10 10" aria-hidden="true">
          <circle cx="5" cy="5" r="4.5" fill="none" stroke="var(--color-text-muted)" />
        </svg>
      );
  }
}

/** Shape and word together */
export function Status({ status, word }: { status: StatusKind; word?: string }) {
  return (
    <span className="status">
      <StatusShape status={status} />
      <span>{word ?? WORDS[status]}</span>
    </span>
  );
}
