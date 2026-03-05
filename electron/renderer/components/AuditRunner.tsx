/**
 * Audit runner form with URL input, options, and Run/Cancel button.
 */

import { useState, type FormEvent } from 'react';

interface AuditRunnerProps {
  isRunning: boolean;
  onRun: (url: string, options: { measureCwv: boolean; crawl: boolean; maxPages: number }) => void;
  onCancel: () => void;
}

export function AuditRunner({ isRunning, onRun, onCancel }: AuditRunnerProps) {
  const [url, setUrl] = useState('');
  const [measureCwv, setMeasureCwv] = useState(false);
  const [crawl, setCrawl] = useState(false);
  const [maxPages, setMaxPages] = useState(10);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    let normalizedUrl = url.trim();
    if (!/^https?:\/\//i.test(normalizedUrl)) {
      normalizedUrl = `https://${normalizedUrl}`;
    }
    onRun(normalizedUrl, { measureCwv, crawl, maxPages });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* URL input */}
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Enter URL to audit (e.g., example.com)"
            disabled={isRunning}
            className="w-full px-4 py-2.5 rounded-lg border-2 border-[var(--color-border)] bg-[var(--color-bg)] text-sm focus:outline-none focus:border-[var(--color-accent)] disabled:opacity-50 transition-colors placeholder:text-[var(--color-text-muted)]"
            style={{ color: 'var(--color-text)' }}
          />
        </div>
        {isRunning ? (
          <button
            type="button"
            onClick={onCancel}
            className="px-5 py-2.5 rounded-lg text-sm font-medium text-white transition-colors"
            style={{ backgroundColor: 'var(--color-fail)' }}
          >
            Cancel
          </button>
        ) : (
          <button
            type="submit"
            disabled={!url.trim()}
            className="px-5 py-2.5 rounded-lg text-sm font-medium text-white disabled:opacity-40 transition-colors"
            style={{ backgroundColor: 'var(--color-accent)' }}
          >
            Run Audit
          </button>
        )}
      </div>

      {/* Options */}
      <div className="flex items-center gap-4">
        <label
          className="flex items-center gap-2 text-xs font-medium cursor-pointer px-3 py-1.5 rounded-lg border transition-colors"
          style={{
            color: measureCwv ? 'var(--color-accent)' : 'var(--color-text-muted)',
            borderColor: measureCwv ? 'var(--color-accent)' : 'var(--color-border)',
            backgroundColor: measureCwv ? 'var(--color-accent-light)' : 'transparent',
          }}
        >
          <input
            type="checkbox"
            checked={measureCwv}
            onChange={(e) => setMeasureCwv(e.target.checked)}
            disabled={isRunning}
            className="sr-only"
          />
          Core Web Vitals
        </label>
        <label
          className="flex items-center gap-2 text-xs font-medium cursor-pointer px-3 py-1.5 rounded-lg border transition-colors"
          style={{
            color: crawl ? 'var(--color-accent)' : 'var(--color-text-muted)',
            borderColor: crawl ? 'var(--color-accent)' : 'var(--color-border)',
            backgroundColor: crawl ? 'var(--color-accent-light)' : 'transparent',
          }}
        >
          <input
            type="checkbox"
            checked={crawl}
            onChange={(e) => setCrawl(e.target.checked)}
            disabled={isRunning}
            className="sr-only"
          />
          Crawl site
        </label>
        {crawl && (
          <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            Max pages:
            <input
              type="range"
              min={2}
              max={50}
              value={maxPages}
              onChange={(e) => setMaxPages(Number(e.target.value))}
              disabled={isRunning}
              className="w-24 accent-[var(--color-accent)]"
            />
            <span className="text-xs font-mono w-6 text-right" style={{ color: 'var(--color-text-muted)' }}>{maxPages}</span>
          </label>
        )}
      </div>
    </form>
  );
}
