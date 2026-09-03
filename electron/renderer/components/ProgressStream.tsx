/**
 * Live progress display during an audit.
 *
 * Driven by the run state streamed from the main process, so a crawl shows
 * one row per category rather than one per category per page, and the crawl
 * itself is visible instead of the page sitting still until scoring starts.
 */

import type { RunState } from '../../shared/ipc-types.js';

interface ProgressStreamProps {
  run: RunState;
}

// All 20 category display names in audit order
const ALL_CATEGORIES = [
  { id: 'core', name: 'Core SEO' },
  { id: 'technical', name: 'Technical SEO' },
  { id: 'perf', name: 'Performance' },
  { id: 'links', name: 'Links' },
  { id: 'images', name: 'Images' },
  { id: 'security', name: 'Security' },
  { id: 'crawl', name: 'Crawlability' },
  { id: 'schema', name: 'Structured Data' },
  { id: 'a11y', name: 'Accessibility' },
  { id: 'content', name: 'Content' },
  { id: 'social', name: 'Social' },
  { id: 'eeat', name: 'E-E-A-T' },
  { id: 'url', name: 'URL Structure' },
  { id: 'mobile', name: 'Mobile' },
  { id: 'i18n', name: 'Internationalization' },
  { id: 'legal', name: 'Legal' },
  { id: 'js', name: 'JS Rendering' },
  { id: 'redirect', name: 'Redirects' },
  { id: 'htmlval', name: 'HTML Validation' },
  { id: 'geo', name: 'AI/GEO' },
];

export function ProgressStream({ run }: ProgressStreamProps) {
  const scores = new Map(run.categories.map((c) => [c.categoryId, c.score]));
  const completedCount = scores.size;
  const crawling = run.phase === 'crawling' && run.crawl !== null;

  // During the crawl the meaningful number is pages found; during scoring it
  // is categories finished.
  const [label, value, total] = crawling
    ? ['Crawling…', run.crawl!.crawled, Math.max(run.crawl!.total, 1)]
    : ['Auditing…', completedCount, ALL_CATEGORIES.length];

  const currentUrl = crawling ? run.crawl?.currentUrl : run.pages.currentUrl;

  return (
    <div className="space-y-4">
      {/* Progress bar */}
      <div>
        <div className="flex justify-between mb-1">
          <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
            {label}
          </span>
          <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            {crawling
              ? `${value} / ${total} pages`
              : `${value} / ${total} categories`}
          </span>
        </div>
        <div className="h-2 rounded-full bg-[var(--color-border)]">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${Math.min(100, (value / total) * 100)}%`,
              backgroundColor: 'var(--color-accent)',
            }}
          />
        </div>
      </div>

      {/* What is being worked on right now */}
      {currentUrl && (
        <div className="text-xs truncate" style={{ color: 'var(--color-text-secondary)' }}>
          {currentUrl}
        </div>
      )}

      {/* Page progress (crawl mode, while scoring) */}
      {!crawling && run.pages.total > 1 && (
        <div className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
          Page {run.pages.completed} of {run.pages.total}
        </div>
      )}

      {/* Category list */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-1">
        {ALL_CATEGORIES.map(({ id, name }) => {
          const score = scores.get(id);
          const completed = score !== undefined;

          return (
            <div key={id} className="flex items-center gap-2 py-1">
              {completed ? (
                <span className="text-sm" style={{ color: 'var(--color-pass)' }}>{'✓'}</span>
              ) : (
                <span className="w-3.5 h-3.5 rounded-full border border-[var(--color-border)]" />
              )}
              <span
                className="text-sm"
                style={{
                  color: completed ? 'var(--color-text)' : 'var(--color-text-muted)',
                }}
              >
                {name}
              </span>
              {completed && (
                <span className="text-xs ml-auto" style={{ color: 'var(--color-text-muted)' }}>
                  {Math.round(score)}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
