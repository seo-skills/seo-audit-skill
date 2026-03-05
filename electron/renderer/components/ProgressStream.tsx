/**
 * Live progress display during an audit.
 * Shows categories with animated checkmarks/spinners as they complete.
 */

import type { AuditProgress } from '../stores/audit-store.js';

interface ProgressStreamProps {
  progress: AuditProgress;
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

export function ProgressStream({ progress }: ProgressStreamProps) {
  const completedIds = new Set(progress.completedCategories.map((c) => c.categoryId));
  const completedCount = completedIds.size;

  return (
    <div className="space-y-4">
      {/* Progress bar */}
      <div>
        <div className="flex justify-between mb-1">
          <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
            Auditing...
          </span>
          <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            {completedCount} / {ALL_CATEGORIES.length} categories
          </span>
        </div>
        <div className="h-2 rounded-full bg-[var(--color-border)]">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${(completedCount / ALL_CATEGORIES.length) * 100}%`,
              backgroundColor: 'var(--color-accent)',
            }}
          />
        </div>
      </div>

      {/* Page progress (crawl mode) */}
      {progress.totalPages > 1 && (
        <div className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
          Page {progress.currentPage} of {progress.totalPages}
        </div>
      )}

      {/* Category list */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-1">
        {ALL_CATEGORIES.map(({ id, name }) => {
          const completed = completedIds.has(id);
          const isCurrent = progress.currentCategory === id;

          return (
            <div key={id} className="flex items-center gap-2 py-1">
              {completed ? (
                <span className="text-sm" style={{ color: 'var(--color-pass)' }}>{'\u2713'}</span>
              ) : isCurrent ? (
                <span className="inline-block w-3.5 h-3.5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--color-accent)', borderTopColor: 'transparent' }} />
              ) : (
                <span className="w-3.5 h-3.5 rounded-full border border-[var(--color-border)]" />
              )}
              <span
                className="text-sm"
                style={{
                  color: completed
                    ? 'var(--color-text)'
                    : isCurrent
                      ? 'var(--color-accent)'
                      : 'var(--color-text-muted)',
                  fontWeight: isCurrent ? 500 : 400,
                }}
              >
                {name}
              </span>
              {completed && (
                <span className="text-xs ml-auto" style={{ color: 'var(--color-text-muted)' }}>
                  {Math.round(
                    progress.completedCategories.find((c) => c.categoryId === id)?.result.score ?? 0,
                  )}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
