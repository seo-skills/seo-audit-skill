/**
 * The run form: every option a run can take, in the open (DESIGN.md, run screen).
 *
 * The engine takes more than the form used to offer — the mobile render and
 * the interaction run were hidden until rendering was on, and categories, the
 * page timeout, staging, the crawl time limit, crawl-delay and the link cache
 * were CLI-only. Now each is on the page, grouped by what it decides, and an
 * option that needs another one first (or that this host cannot do) stays
 * visible, disabled, with the reason beside it rather than disappearing.
 *
 * The right column says what the run will do, and the same run as a CLI
 * command: every option here is a real flag, so the two can be copied across.
 * Choices persist, because the second audit of a site is almost always run the
 * same way as the first.
 */

import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import type { AuditRunArgs, Capabilities } from '../../electron/shared/ipc-types.js';
import { CATEGORY_NAMES } from '../lib/fixes.js';

interface AuditRunnerProps {
  isRunning: boolean;
  capabilities: Capabilities | null;
  /** Every category with its weight, from the app info; null until it loads */
  categories: Array<{ id: string; name: string; weight: number }> | null;
  /** Pre-fills the form, for re-running an audit with the options it used */
  initialUrl?: string;
  initialOptions?: Partial<AuditRunArgs>;
  /** The agent and the headline, above the form */
  header?: ReactNode;
  onRun: (url: string, options: Omit<AuditRunArgs, 'url'>) => void;
  onCancel: () => void;
}

const STORAGE_KEY = 'seomator:run-options';

interface StoredOptions {
  measureCwv: boolean;
  mobile: boolean;
  simulateInteraction: boolean;
  crawl: boolean;
  maxPages: number;
  concurrency: number;
  /** Seconds; 0 means the session's own limit */
  maxDuration: number;
  ignoreCrawlDelay: boolean;
  staging: boolean;
  /** Empty means every category */
  categories: string[];
  /** Seconds per page request */
  timeout: number;
  refresh: boolean;
  save: boolean;
}

const DEFAULTS: StoredOptions = {
  measureCwv: false,
  mobile: false,
  simulateInteraction: false,
  crawl: false,
  maxPages: 10,
  concurrency: 3,
  maxDuration: 0,
  ignoreCrawlDelay: false,
  staging: false,
  categories: [],
  timeout: 30,
  refresh: false,
  save: true,
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

const clampInt = (value: number, min: number, max: number) =>
  Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value))) : min;

/** The same run as a `seomator audit` command, one entry per word or flag */
function cliCommand(url: string, o: StoredOptions, total: number): string[] {
  const parts = ['seomator audit', url || 'https://example.com'];
  if (o.measureCwv) parts.push('--render');
  if (o.measureCwv && o.mobile) parts.push('--mobile');
  if (o.measureCwv && o.simulateInteraction) parts.push('--simulate-interaction');
  if (o.crawl) {
    parts.push('--crawl', `-m ${o.maxPages}`);
    if (o.concurrency !== DEFAULTS.concurrency) parts.push(`--concurrency ${o.concurrency}`);
    if (o.maxDuration > 0) parts.push(`--max-duration ${o.maxDuration}`);
    if (o.ignoreCrawlDelay) parts.push('--ignore-crawl-delay');
  }
  if (o.staging) parts.push('--staging');
  if (o.categories.length > 0 && o.categories.length < total) parts.push(`-c ${o.categories.join(',')}`);
  if (o.timeout !== DEFAULTS.timeout) parts.push(`--timeout ${o.timeout * 1000}`);
  if (o.refresh) parts.push('--refresh');
  if (!o.save) parts.push('--no-save');
  return parts;
}

export function AuditRunner({
  isRunning,
  capabilities,
  categories,
  initialUrl,
  initialOptions,
  header,
  onRun,
  onCancel,
}: AuditRunnerProps) {
  const [url, setUrl] = useState(initialUrl ?? '');
  const [options, setOptions] = useState<StoredOptions>(() => ({
    ...loadOptions(),
    ...(initialOptions as Partial<StoredOptions> | undefined),
  }));
  const [copied, setCopied] = useState(false);

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

  const canRender = capabilities?.browserRender !== false;
  const canMobile = capabilities?.mobileParity !== false;
  const canInteract = capabilities?.simulateInteraction !== false;
  const canSave = capabilities?.persistence !== false;
  const allCategories =
    categories ?? Object.keys(CATEGORY_NAMES).map((id) => ({ id, name: CATEGORY_NAMES[id]!, weight: 0 }));
  const chosen = options.categories.length === 0 ? allCategories.map((c) => c.id) : options.categories;
  const chosenWeight = allCategories.filter((c) => chosen.includes(c.id)).reduce((sum, c) => sum + c.weight, 0);
  const trimmed = url.trim();
  const normalizedUrl = trimmed && !/^https?:\/\//i.test(trimmed) ? `https://${trimmed}` : trimmed;

  const toggleCategory = (id: string) => {
    const next = chosen.includes(id) ? chosen.filter((c) => c !== id) : [...chosen, id];
    // At least one category: an audit of nothing is not an audit
    if (next.length === 0) return;
    set('categories', next.length === allCategories.length ? [] : next);
  };

  const handleSubmit = (event: FormEvent): void => {
    event.preventDefault();
    if (!normalizedUrl) return;
    const o = options;
    onRun(normalizedUrl, {
      measureCwv: o.measureCwv && canRender,
      ...(o.measureCwv && canMobile && { mobile: o.mobile }),
      ...(o.measureCwv && canInteract && { simulateInteraction: o.simulateInteraction }),
      crawl: o.crawl,
      ...(o.crawl && {
        maxPages: o.maxPages,
        concurrency: o.concurrency,
        ignoreCrawlDelay: o.ignoreCrawlDelay,
        ...(o.maxDuration > 0 && { maxDuration: o.maxDuration }),
      }),
      staging: o.staging,
      ...(o.categories.length > 0 && { categories: o.categories }),
      timeout: o.timeout * 1000,
      refresh: o.refresh,
      save: o.save && canSave,
    });
  };

  const commandParts = cliCommand(normalizedUrl, options, allCategories.length);
  const command = commandParts.join(' ');
  const copyCommand = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="grid lg:grid-cols-[8fr_4fr]">
      <div className="py-10 lg:pr-12 min-w-0">
        {header}

        <div className="flex gap-3">
          <input
            type="text"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="example.com"
            disabled={isRunning}
            required
            aria-label="URL to audit"
            className="flex-1 min-w-0 h-10 px-3 rounded-[4px] border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] font-mono text-sm focus:outline-none focus:border-[var(--color-text)] focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-text)_12%,transparent)] disabled:opacity-50 transition-colors placeholder:text-[var(--color-text-muted)]"
            style={{ color: 'var(--color-text)' }}
          />
          {isRunning ? (
            <button type="button" onClick={onCancel} className="btn btn-md">
              Cancel
            </button>
          ) : (
            <button type="submit" className="btn btn-md btn-primary">
              {/* Never disabled for an empty field: a grey orange button reads
                  as broken. The input's `required` stops an empty submit. */}
              Run audit
            </button>
          )}
        </div>

        <Group title="Measure">
          <Option
            label="Core Web Vitals and the rendered page"
            hint="PageSpeed-style lab metrics (LCP, CLS, INP, TBT), accessibility with axe, unused JavaScript and CSS, and image sizing. Opens each page in a browser: 5 to 15 seconds more a page."
            checked={options.measureCwv && canRender}
            disabled={isRunning || !canRender}
            disabledReason={!canRender ? 'This build cannot render pages in a browser.' : undefined}
            onChange={(value) => set('measureCwv', value)}
          />
          <Nested>
            <Option
              label="Mobile parity"
              hint="Renders again at a phone size and reports what differs from desktop."
              checked={options.mobile && options.measureCwv && canMobile}
              disabled={isRunning || !canMobile || !options.measureCwv}
              disabledReason={
                !canMobile
                  ? 'Not available in this app: run it from the CLI or the web dashboard.'
                  : !options.measureCwv
                    ? 'Needs Core Web Vitals on.'
                    : undefined
              }
              onChange={(value) => set('mobile', value)}
            />
            <Option
              label="Simulate interaction"
              hint="Clicks and scrolls the page so responsiveness (INP) can be measured."
              checked={options.simulateInteraction && options.measureCwv && canInteract}
              disabled={isRunning || !canInteract || !options.measureCwv}
              disabledReason={
                !canInteract
                  ? 'Not available in this app: run it from the CLI or the web dashboard.'
                  : !options.measureCwv
                    ? 'Needs Core Web Vitals on.'
                    : undefined
              }
              onChange={(value) => set('simulateInteraction', value)}
            />
          </Nested>
        </Group>

        <Group title="Scope">
          <Option
            label="Crawl linked pages"
            hint="Audits the pages this one links to, not just this URL, and adds the checks that compare pages. Much slower."
            checked={options.crawl}
            disabled={isRunning}
            onChange={(value) => set('crawl', value)}
          />
          <Nested>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 py-1.5">
              <NumberField
                label="Pages, at most"
                value={options.maxPages}
                min={1}
                max={1000}
                disabled={isRunning || !options.crawl}
                onChange={(value) => set('maxPages', value)}
              />
              <NumberField
                label="Pages at once"
                value={options.concurrency}
                min={1}
                max={20}
                disabled={isRunning || !options.crawl}
                onChange={(value) => set('concurrency', value)}
              />
              <NumberField
                label="Time limit, seconds"
                value={options.maxDuration}
                min={10}
                max={3600}
                placeholder="1 hour"
                hint="Empty: the hour every run gets"
                disabled={isRunning || !options.crawl}
                onChange={(value) => set('maxDuration', value)}
              />
            </div>
            <Option
              label="Ignore the site's crawl-delay"
              hint="Does not wait between pages when robots.txt asks it to. Only on a site you run."
              checked={options.ignoreCrawlDelay && options.crawl}
              disabled={isRunning || !options.crawl}
              disabledReason={!options.crawl ? 'Needs Crawl linked pages on.' : undefined}
              onChange={(value) => set('ignoreCrawlDelay', value)}
            />
          </Nested>
          <Option
            label="Staging site"
            hint="For a site kept out of search on purpose: waives the noindex and robots.txt score caps and crawls past robots.txt. The caps it waived are listed with the result."
            checked={options.staging}
            disabled={isRunning}
            onChange={(value) => set('staging', value)}
          />
        </Group>

        <Group
          title="Categories"
          aside={
            <span className="figure text-xs text-[var(--color-text-muted)]">
              {chosen.length} of {allCategories.length}
              {categories && ` · ${chosenWeight}% of the score`}
              {options.categories.length > 0 && (
                <>
                  {' · '}
                  <button
                    type="button"
                    className="underline underline-offset-[3px] hover:text-[var(--color-text)] disabled:opacity-50"
                    disabled={isRunning}
                    onClick={() => set('categories', [])}
                  >
                    select all
                  </button>
                </>
              )}
            </span>
          }
        >
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-3 gap-y-0.5">
            {allCategories.map((category) => (
              <label
                key={category.id}
                className="flex items-center gap-2 rounded-[4px] px-2 py-1.5 -mx-2 text-[13px] cursor-pointer hover:bg-[var(--color-bg-hover)] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--color-accent)]"
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={chosen.includes(category.id)}
                  disabled={isRunning}
                  onChange={() => toggleCategory(category.id)}
                />
                <Box checked={chosen.includes(category.id)} />
                <span className="truncate">{category.name}</span>
                {category.weight > 0 && (
                  <span className="figure ml-auto text-[11px] text-[var(--color-text-muted)]">{category.weight}%</span>
                )}
              </label>
            ))}
          </div>
        </Group>

        <Group title="Run settings">
          <div className="py-1.5 max-w-[200px]">
            <NumberField
              label="Page timeout, seconds"
              value={options.timeout}
              min={1}
              max={120}
              disabled={isRunning}
              onChange={(value) => set('timeout', value)}
            />
          </div>
          <Option
            label="Check external links again"
            hint="Asks every outbound link afresh instead of using the answers cached from earlier runs."
            checked={options.refresh}
            disabled={isRunning}
            onChange={(value) => set('refresh', value)}
          />
          <Option
            label="Save to history"
            hint="Keeps the result with your other audits so it can be compared and re-opened."
            checked={options.save && canSave}
            disabled={isRunning || !canSave}
            disabledReason={!canSave ? 'This build cannot store audits.' : undefined}
            onChange={(value) => set('save', value)}
          />
        </Group>
      </div>

      <aside className="py-10 lg:pl-8 border-t lg:border-t-0 lg:border-l border-[var(--color-border)] min-w-0">
        <div className="lg:sticky lg:top-[calc(var(--header-height)+24px)]">
          <div className="label">This run</div>
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[13px]">
            <Row term="Pages" value={options.crawl ? `up to ${options.maxPages.toLocaleString()}, ${options.concurrency} at once` : '1'} />
            <Row term="Browser render" value={options.measureCwv && canRender ? 'On' : 'Off'} />
            {options.measureCwv && canRender && (
              <Row
                term="Also"
                value={
                  [options.mobile && canMobile && 'mobile', options.simulateInteraction && canInteract && 'interaction']
                    .filter(Boolean)
                    .join(', ') || 'nothing else'
                }
              />
            )}
            <Row term="Categories" value={`${chosen.length} of ${allCategories.length}`} />
            {options.crawl && <Row term="Time limit" value={options.maxDuration > 0 ? `${options.maxDuration} s` : '1 hour'} />}
            <Row term="Page timeout" value={`${options.timeout} s`} />
            {options.staging && <Row term="Staging" value="caps waived" />}
            <Row term="History" value={options.save && canSave ? 'saved' : 'not saved'} />
          </dl>

          <div className="mt-6">
            <div className="label mb-2">Same run from the terminal</div>
            {/* Each flag stays whole when the line wraps: "-m 10" never splits */}
            <pre className="figure text-xs leading-5 whitespace-normal p-3 border border-[var(--color-border)] bg-[var(--color-bg-elevated)]">
              {commandParts.map((part, i) => (
                // A long value (the category list) wraps at its commas instead
                // of being cut off: what is shown is what gets copied
                <span key={i} className={`mr-[0.6em] ${part.length > 40 ? '[overflow-wrap:anywhere]' : 'inline-block whitespace-nowrap'}`}>
                  {part.length > 40 ? part.replace(/,/g, ',\u200b') : part}
                </span>
              ))}
            </pre>
            <button type="button" className="btn btn-ghost mt-2 -ml-3" onClick={() => void copyCommand()} aria-live="polite">
              <span key={String(copied)} className="copy-swap">{copied ? 'Copied' : 'Copy command'}</span>
            </button>
          </div>
        </div>
      </aside>
    </form>
  );
}

function Group({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="mt-8 pt-5 border-t border-[var(--color-border)] min-w-0" aria-label={title}>
      <div className="flex items-baseline justify-between gap-4 mb-2">
        <h2 className="label">{title}</h2>
        {aside}
      </div>
      <div className="space-y-0.5">{children}</div>
    </section>
  );
}

function Nested({ children }: { children: ReactNode }) {
  return <div className="ml-[26px] pl-3 border-l border-[var(--color-border)] space-y-0.5">{children}</div>;
}

function Row({ term, value }: { term: string; value: string }) {
  return (
    <>
      <dt className="text-[var(--color-text-muted)]">{term}</dt>
      <dd className="text-right">{value}</dd>
    </>
  );
}

/** The checkbox, drawn: an empty box when off, ink with a tick when on */
function Box({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden="true"
      className="shrink-0 grid place-items-center rounded-[3px] border transition-colors"
      style={{
        width: 16,
        height: 16,
        borderColor: checked ? 'var(--color-accent)' : 'var(--color-border-strong)',
        backgroundColor: checked ? 'var(--color-accent)' : 'var(--color-bg-elevated)',
        color: 'var(--color-on-accent)',
      }}
    >
      {checked && (
        <svg viewBox="0 0 12 12" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.2">
          <path d="M2.5 6.5l2.5 2.5 4.5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </span>
  );
}

/**
 * One run option: what it does, and what it costs.
 *
 * The cost belongs in the description as much as the effect: measured on one
 * site, the same audit took 8 seconds without crawl and 4 minutes 29 with it.
 * Someone choosing between those should know before they wait. A disabled
 * option says why, in place of its description.
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
      className="flex items-start gap-2.5 rounded-[4px] px-2 py-2 -mx-2 transition-colors hover:bg-[var(--color-bg-hover)] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--color-accent)]"
      style={{ opacity: disabled ? 0.55 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="sr-only"
      />
      <span className="mt-0.5">
        <Box checked={checked} />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium leading-tight" style={{ color: 'var(--color-text)' }}>
          {label}
        </span>
        <span className="block text-xs leading-snug mt-1 max-w-[60ch]" style={{ color: 'var(--color-text-muted)' }}>
          {disabled && disabledReason ? disabledReason : hint}
        </span>
      </span>
    </label>
  );
}

/**
 * A number the reader types. It keeps what they type while they type it — a
 * field that clamps on every keystroke turns "120" into 10 after the "1" — and
 * takes a value as soon as it is in range, clamping only when they leave.
 * With a placeholder, empty means "not set" and reports 0.
 */
function NumberField({
  label,
  value,
  min,
  max,
  placeholder,
  hint,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  placeholder?: string;
  hint?: string;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  const shown = (n: number) => (n === 0 && placeholder ? '' : String(n));
  const [text, setText] = useState(shown(value));
  useEffect(() => setText(value === 0 && placeholder ? '' : String(value)), [value, placeholder]);

  const commit = () => {
    if (text.trim() === '') {
      const empty = placeholder ? 0 : min;
      onChange(empty);
      setText(shown(empty));
      return;
    }
    const next = clampInt(Number(text), min, max);
    onChange(next);
    setText(shown(next));
  };

  return (
    <label className="block min-w-0" style={{ opacity: disabled ? 0.55 : 1 }}>
      <span className="label block mb-1">{label}</span>
      <input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={text}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(event) => {
          const raw = event.target.value;
          setText(raw);
          const n = Number(raw);
          if (raw !== '' && Number.isInteger(n) && n >= min && n <= max) onChange(n);
        }}
        onBlur={commit}
        className="w-full h-8 px-2 rounded-[4px] border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] font-mono text-[13px] focus:outline-none focus:border-[var(--color-text)] focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-text)_12%,transparent)] disabled:cursor-not-allowed"
        style={{ color: 'var(--color-text)' }}
      />
      {hint && <span className="block mt-1 text-[11px] text-[var(--color-text-muted)]">{hint}</span>}
    </label>
  );
}
