/**
 * A button that opens a small menu: Export, and the ⋯ overflow.
 *
 * Closes on Escape, on a click outside, and after a choice. Focus moves to the
 * first item on open and back to the button on close, so it works from the
 * keyboard the way a native menu does.
 */

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

export interface MenuItem {
  label: string;
  hint?: string;
  danger?: boolean;
  disabled?: boolean;
  /** The current choice, for a menu that picks one of several */
  checked?: boolean;
  onSelect: () => void;
}

export function Menu({
  label,
  button,
  items,
  className = 'btn',
}: {
  /** Accessible name of the button */
  label: string;
  /** What the button shows */
  button: ReactNode;
  items: MenuItem[];
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    // Focus the current choice when there is one, else the first item
    (root.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]') ??
      root.current?.querySelector<HTMLButtonElement>('[role^="menuitem"]:not(:disabled)'))?.focus();
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        trigger.current?.focus();
        return;
      }
      // Arrow keys move through the items, Home and End jump, as a native menu does
      const items = [...(root.current?.querySelectorAll<HTMLButtonElement>('[role^="menuitem"]:not(:disabled)') ?? [])];
      if (items.length === 0) return;
      const at = items.indexOf(document.activeElement as HTMLButtonElement);
      const next =
        event.key === 'ArrowDown' ? (at + 1) % items.length
        : event.key === 'ArrowUp' ? (at - 1 + items.length) % items.length
        : event.key === 'Home' ? 0
        : event.key === 'End' ? items.length - 1
        : null;
      if (next === null) return;
      event.preventDefault();
      items[next]?.focus();
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button
        ref={trigger}
        type="button"
        className={className}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((v) => !v)}
      >
        {button}
      </button>
      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label={label}
          className="menu absolute right-0 top-[calc(100%+4px)] z-20 w-max max-w-[min(360px,90vw)] max-h-[min(420px,60vh)] overflow-y-auto"
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role={item.checked === undefined ? 'menuitem' : 'menuitemradio'}
              aria-checked={item.checked}
              disabled={item.disabled}
              className="menu-item whitespace-nowrap disabled:opacity-45"
              style={item.danger ? { color: 'var(--color-fail)' } : undefined}
              onClick={() => {
                setOpen(false);
                trigger.current?.focus();
                item.onSelect();
              }}
            >
              <span className={`min-w-0 truncate ${item.checked ? 'font-medium' : ''}`}>
                {item.checked !== undefined && (
                  <span aria-hidden="true" className="inline-block w-4">{item.checked ? '✓' : ''}</span>
                )}
                {item.label}
              </span>
              {item.hint && <span className="figure shrink-0 text-[var(--color-text-muted)]">{item.hint}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
