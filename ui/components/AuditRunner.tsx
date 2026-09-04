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
            className="px-5 py-2.5 rounded-lg text-sm font-medium text-white"
            style={{ backgroundColor: 'var(--color-fail)' }}
          >
            Cancel
          </button>
        ) : (
          <button
            type="submit"
            disabled={!url.trim()}
            className="px-5 py-2.5 rounded-lg text-sm font-medium text-white disabled:opacity-40"
            style={{ backgroundColor: 'var(--color-accent)' }}
          >
            Run audit
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Toggle
          label="Core Web Vitals"
          checked={options.measureCwv}
          disabled={isRunning || capabilities?.browserRender === false}
          onChange={(value) => set('measureCwv', value)}
          title={
            capabilities?.browserRender === false
              ? 'This build cannot render pages in a browser'
              : 'Render the page in a browser to measure loading performance'
          }
        />
        <Toggle
          label="Crawl site"
          checked={options.crawl}
          disabled={isRunning}
          onChange={(value) => set('crawl', value)}
        />

        {options.measureCwv && capabilities?.mobileParity && (
          <Toggle
            label="Mobile parity"
            checked={options.mobile}
            disabled={isRunning}
            onChange={(value) => set('mobile', value)}
            title="Render a second time at a phone viewport and compare"
          />
        )}
        {options.measureCwv && capabilities?.simulateInteraction && (
          <Toggle
            label="Simulate interaction"
            checked={options.simulateInteraction}
            disabled={isRunning}
            onChange={(value) => set('simulateInteraction', value)}
            title="Click and scroll the page so responsiveness can be measured"
          />
        )}

        {options.crawl && (
          <>
            <Slider
              label="Max pages"
              value={options.maxPages}
              min={2}
              max={100}
              disabled={isRunning}
              onChange={(value) => set('maxPages', value)}
            />
            <Slider
              label="Concurrency"
              value={options.concurrency}
              min={1}
              max={10}
              disabled={isRunning}
              onChange={(value) => set('concurrency', value)}
            />
          </>
        )}
      </div>
    </form>
  );
}

function Toggle({
  label,
  checked,
  disabled,
  title,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  title?: string;
  onChange: (value: boolean) => void;
}) {
  return (
    <label
      title={title}
      className="flex items-center gap-2 text-xs font-medium cursor-pointer px-3 py-1.5 rounded-lg border transition-colors"
      style={{
        color: checked ? 'var(--color-accent)' : 'var(--color-text-muted)',
        borderColor: checked ? 'var(--color-accent)' : 'var(--color-border)',
        backgroundColor: checked ? 'var(--color-accent-light)' : 'transparent',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="sr-only"
      />
      {label}
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
