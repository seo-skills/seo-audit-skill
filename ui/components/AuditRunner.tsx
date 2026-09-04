/**
 * The run form.
 *
 * Options are gated by what the host can actually do — the desktop app renders
 * in a BrowserWindow, which has no mobile emulation and no synthetic
 * interaction, so offering those there would be offering settings that quietly
 * do nothing. Choices persist, because the second audit of a site is almost
 * always run the same way as the first.
 */

import { useEffect, useState, type FormEvent } from 'react';
import type { AuditRunArgs, Capabilities } from '../../electron/shared/ipc-types.js';

interface AuditRunnerProps {
  isRunning: boolean;
  capabilities: Capabilities | null;
  /** Pre-fills the form, for re-running an audit with the options it used */
  initialUrl?: string;
  initialOptions?: Partial<AuditRunArgs>;
  onRun: (url: string, options: Omit<AuditRunArgs, 'url'>) => void;
  onCancel: () => void;
}

const STORAGE_KEY = 'seomator:run-options';

interface StoredOptions {
  measureCwv: boolean;
  crawl: boolean;
  maxPages: number;
  concurrency: number;
  mobile: boolean;
  simulateInteraction: boolean;
}

const DEFAULTS: StoredOptions = {
  measureCwv: false,
  crawl: false,
  maxPages: 10,
  concurrency: 3,
  mobile: false,
  simulateInteraction: false,
};

function loadOptions(): StoredOptions {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<StoredOptions>) } : DEFAULTS;
  } catch {
    // Private windows and cleared site data both land here.
    return DEFAULTS;
  }
}

export function AuditRunner({
  isRunning,
  capabilities,
  initialUrl,
  initialOptions,
  onRun,
  onCancel,
}: AuditRunnerProps) {
  const [url, setUrl] = useState(initialUrl ?? '');
  const [options, setOptions] = useState<StoredOptions>(() => ({ ...loadOptions(), ...initialOptions }));

  useEffect(() => {
    if (initialUrl) setUrl(initialUrl);
  }, [initialUrl]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(options));
    } catch {
      // Not being able to remember a preference is not worth surfacing.
    }
  }, [options]);

  const set = <K extends keyof StoredOptions>(key: K, value: StoredOptions[K]): void =>
    setOptions((current) => ({ ...current, [key]: value }));

  const handleSubmit = (event: FormEvent): void => {
    event.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) return;
    const normalized = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

    onRun(normalized, {
      measureCwv: options.measureCwv,
      crawl: options.crawl,
      ...(options.crawl && { maxPages: options.maxPages, concurrency: options.concurrency }),
      ...(options.measureCwv && capabilities?.mobileParity && { mobile: options.mobile }),
      ...(options.measureCwv &&
        capabilities?.simulateInteraction && { simulateInteraction: options.simulateInteraction }),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex gap-3">
        <input
          type="text"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="Enter a URL to audit (example.com)"
          disabled={isRunning}
          aria-label="URL to audit"
          className="flex-1 px-4 py-2.5 rounded-lg border-2 border-[var(--color-border)] bg-[var(--color-bg)] text-sm focus:outline-none focus:border-[var(--color-accent)] disabled:opacity-50 transition-colors placeholder:text-[var(--color-text-muted)]"
          style={{ color: 'var(--color-text)' }}
        />
        {isRunning ? (
          <button
            type="button"
            onClick={onCancel}
            className="px-5 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap"
            style={{ backgroundColor: 'var(--color-fail)', color: 'var(--color-on-accent)' }}
          >
            Cancel
          </button>
        ) : (
          <button
            type="submit"
            disabled={!url.trim()}
            className="px-5 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap disabled:opacity-40"
            style={{ backgroundColor: 'var(--color-accent)', color: 'var(--color-on-accent)' }}
          >
            Run audit
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-x-10 gap-y-1">
        <Option
          label="Core Web Vitals"
          hint="Opens the page in a real browser to measure loading speed. Adds about a minute."
          checked={options.measureCwv}
          disabled={isRunning || capabilities?.browserRender === false}
          disabledReason={
            capabilities?.browserRender === false
              ? 'This build cannot render pages in a browser.'
              : undefined
          }
          onChange={(value) => set('measureCwv', value)}
        />

        <Option
          label="Crawl the whole site"
          hint="Audits pages linked from this one, not just this URL. Much slower."
          checked={options.crawl}
          disabled={isRunning}
          onChange={(value) => set('crawl', value)}
        />

        {options.measureCwv && capabilities?.mobileParity && (
          <Option
            label="Mobile parity"
            hint="Renders again at a phone size and reports what differs."
            checked={options.mobile}
            disabled={isRunning}
            onChange={(value) => set('mobile', value)}
          />
        )}
        {options.measureCwv && capabilities?.simulateInteraction && (
          <Option
            label="Simulate interaction"
            hint="Clicks and scrolls the page so responsiveness (INP) can be measured."
            checked={options.simulateInteraction}
            disabled={isRunning}
            onChange={(value) => set('simulateInteraction', value)}
          />
        )}
      </div>

      {options.crawl && (
        // "Concurrency" is a word from the engine, not from the user's problem,
        // and it sat with equal weight beside the control people actually reach
        // for. Both are here, named for what they do, one fold away.
        <details className="mt-1">
          <summary className="text-xs cursor-pointer w-fit" style={{ color: 'var(--color-text-muted)' }}>
            Crawl settings — up to {options.maxPages} pages, {options.concurrency} at a time
          </summary>
          <div className="flex flex-wrap items-center gap-6 mt-3">
            <Slider
              label="Pages to audit, at most"
              value={options.maxPages}
              min={2}
              max={100}
              disabled={isRunning}
              onChange={(value) => set('maxPages', value)}
            />
            <Slider
              label="Pages fetched at once"
              value={options.concurrency}
              min={1}
              max={10}
              disabled={isRunning}
              onChange={(value) => set('concurrency', value)}
            />
          </div>
        </details>
      )}
    </form>
  );
}

/**
 * One run option: what it does, and what it costs.
 *
 * These were pills carrying a `title`. A title shows on hover after a delay,
 * never appears on touch, and is read unreliably by assistive tech — so the two
 * settings that decide what the product actually does were, for most people,
 * two unlabelled words. The whole page came to thirteen words.
 *
 * The cost belongs in the description as much as the effect: measured on one
 * site, the same audit took 8 seconds without crawl and 4 minutes 29 with it.
 * Someone choosing between those should know before they wait.
 *
 * The checkbox was `sr-only` inside a bordered pill, so the off state was
 * indistinguishable from a secondary button — no box, no tick, nothing that
 * reads as two-state. The box is drawn now, and it is empty when off.
 */
function Option({
  label,
  hint,
  checked,
  disabled,
  disabledReason,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  disabled?: boolean;
  disabledReason?: string;
  onChange: (value: boolean) => void;
}) {
  return (
    <label
      className="flex items-start gap-2.5 rounded-lg px-2 py-1.5 -mx-2 max-w-sm transition-colors hover:bg-[var(--color-bg-hover)] focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--color-accent)]"
      style={{ opacity: disabled ? 0.5 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="sr-only"
      />
      <span
        aria-hidden="true"
        className="mt-0.5 shrink-0 grid place-items-center rounded border-2 transition-colors"
        style={{
          width: 16,
          height: 16,
          borderColor: checked ? 'var(--color-accent)' : 'var(--color-text-muted)',
          backgroundColor: checked ? 'var(--color-accent)' : 'transparent',
          color: 'var(--color-on-accent)',
        }}
      >
        {checked && (
          <svg viewBox="0 0 12 12" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M2.5 6.5l2.5 2.5 4.5-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
      <span className="min-w-0">
        <span
          className="block text-sm font-medium leading-tight"
          style={{ color: checked ? 'var(--color-accent)' : 'var(--color-text)' }}
        >
          {label}
        </span>
        <span className="block text-xs leading-snug mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
          {disabled && disabledReason ? disabledReason : hint}
        </span>
      </span>
    </label>
  );
}


function Slider({
  label,
  value,
  min,
  max,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
      {label}:
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-24 accent-[var(--color-accent)]"
      />
      <span className="text-xs font-mono w-6 text-right" style={{ color: 'var(--color-text-muted)' }}>
        {value}
      </span>
    </label>
  );
}
