/**
 * Main audit page — run an audit, see live progress, view results.
 */

import { useState, useCallback } from 'react';
import { useAudit } from '../hooks/useAudit.js';
import { AuditRunner } from '../components/AuditRunner.js';
import { ProgressStream } from '../components/ProgressStream.js';
import { ScoreCircle } from '../components/ScoreCircle.js';
import { ScoreStats } from '../components/ScoreStats.js';
import { CategoryGrid } from '../components/CategoryGrid.js';
import { FilterTabs, type FilterStatus } from '../components/FilterTabs.js';
import { IssuesTable } from '../components/IssuesTable.js';
import { CategorySection } from '../components/CategorySection.js';
import { Sidebar } from '../components/Sidebar.js';

export function AuditPage() {
  const { status, progress, result, ruleMetadata, error, run, cancel, reset } = useAudit();
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const handleRun = useCallback(
    (url: string, opts: { measureCwv: boolean; crawl: boolean; maxPages: number }) => {
      setFilter('all');
      setActiveCategory(null);
      run(url, opts);
    },
    [run],
  );

  const handleCategoryClick = useCallback((categoryId: string) => {
    setActiveCategory(categoryId);
    const el = document.getElementById(`category-${categoryId}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const handleIssueClick = useCallback((ruleId: string, categoryId: string) => {
    // Expand the category section and scroll to the rule
    setActiveCategory(categoryId);
    setTimeout(() => {
      const el = document.getElementById(`rule-${ruleId}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Flash highlight
      el?.classList.add('ring-2', 'ring-[var(--color-accent)]');
      setTimeout(() => el?.classList.remove('ring-2', 'ring-[var(--color-accent)]'), 2000);
    }, 100);
  }, []);

  // Calculate filter counts from result
  const counts = result
    ? {
        all: result.categoryResults.reduce(
          (n, c) => n + new Set(c.results.map((r) => r.ruleId)).size,
          0,
        ),
        fail: result.categoryResults.reduce((n, c) => {
          const unique = new Set(c.results.filter((r) => r.status === 'fail').map((r) => r.ruleId));
          return n + unique.size;
        }, 0),
        warn: result.categoryResults.reduce((n, c) => {
          const unique = new Set(c.results.filter((r) => r.status === 'warn').map((r) => r.ruleId));
          return n + unique.size;
        }, 0),
        pass: result.categoryResults.reduce((n, c) => {
          const unique = new Set(c.results.filter((r) => r.status === 'pass').map((r) => r.ruleId));
          return n + unique.size;
        }, 0),
      }
    : { all: 0, fail: 0, warn: 0, pass: 0 };

  const totalFail = result?.categoryResults.reduce((n, c) => n + c.failCount, 0) ?? 0;
  const totalWarn = result?.categoryResults.reduce((n, c) => n + c.warnCount, 0) ?? 0;
  const totalPass = result?.categoryResults.reduce((n, c) => n + c.passCount, 0) ?? 0;

  return (
    <div className="flex min-h-screen">
      {/* Sidebar (only when results are shown) */}
      {status === 'complete' && result && (
        <Sidebar
          categories={result.categoryResults}
          activeCategory={activeCategory}
          onCategoryClick={handleCategoryClick}
        />
      )}

      {/* Main content */}
      <div
        className="flex-1 pt-[var(--header-height)]"
        style={{ marginLeft: status === 'complete' && result ? 'var(--sidebar-width)' : '0' }}
      >
        <div className="max-w-[var(--content-max-width)] mx-auto p-6 space-y-6">
          {/* Audit runner form */}
          <div className="p-5 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border)]" style={{ boxShadow: 'var(--shadow-sm)' }}>
            <AuditRunner isRunning={status === 'running'} onRun={handleRun} onCancel={cancel} />
          </div>

          {/* Running state: progress stream */}
          {status === 'running' && (
            <div className="p-5 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border)]" style={{ boxShadow: 'var(--shadow-sm)' }}>
              <ProgressStream progress={progress} />
            </div>
          )}

          {/* Error state */}
          {status === 'error' && error && (
            <div
              className="p-4 rounded-lg border"
              style={{
                backgroundColor: 'var(--color-fail-bg)',
                borderColor: 'var(--color-fail)',
                color: 'var(--color-fail)',
              }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Audit failed</p>
                  <p className="text-sm mt-1">{error}</p>
                </div>
                <button
                  onClick={reset}
                  className="px-3 py-1.5 text-sm rounded-md font-medium"
                  style={{
                    backgroundColor: 'var(--color-fail)',
                    color: '#fff',
                  }}
                >
                  Try again
                </button>
              </div>
            </div>
          )}

          {/* Results */}
          {status === 'complete' && result && (
            <>
              {/* Score overview */}
              <div
                className="p-6 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border)] flex items-center gap-8"
                style={{ boxShadow: 'var(--shadow-sm)' }}
              >
                <ScoreCircle score={result.overallScore} size={140} />
                <div className="space-y-3">
                  <div>
                    <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
                      Overall Score
                    </h2>
                    <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                      {result.categoryResults.length} categories audited
                      {result.crawledPages > 1 && ` across ${result.crawledPages} pages`}
                    </p>
                  </div>
                  <ScoreStats passCount={totalPass} warnCount={totalWarn} failCount={totalFail} />
                </div>
              </div>

              {/* Category progress grid */}
              <div className="p-5 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border)]" style={{ boxShadow: 'var(--shadow-sm)' }}>
                <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text)' }}>
                  Category Scores
                </h3>
                <CategoryGrid
                  categories={result.categoryResults}
                  activeCategory={activeCategory}
                  onCategoryClick={handleCategoryClick}
                />
              </div>

              {/* Issues summary table */}
              {(totalFail > 0 || totalWarn > 0) && (
                <div className="p-5 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border)]" style={{ boxShadow: 'var(--shadow-sm)' }}>
                  <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text)' }}>
                    Issues to Fix
                  </h3>
                  <IssuesTable result={result} ruleMetadata={ruleMetadata} onIssueClick={handleIssueClick} />
                </div>
              )}

              {/* Filter tabs + detailed results */}
              <div className="p-5 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border)]" style={{ boxShadow: 'var(--shadow-sm)' }}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                    Detailed Results
                  </h3>
                  <FilterTabs active={filter} counts={counts} onChange={setFilter} />
                </div>
                <div className="space-y-1">
                  {result.categoryResults.map((cat) => (
                    <CategorySection
                      key={cat.categoryId}
                      category={cat}
                      filter={filter}
                      ruleMetadata={ruleMetadata}
                      defaultExpanded={
                        activeCategory === cat.categoryId ||
                        (filter === 'fail' && cat.failCount > 0)
                      }
                    />
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Idle state */}
          {status === 'idle' && (
            <div className="text-center py-16" style={{ color: 'var(--color-text-muted)' }}>
              <svg
                className="mx-auto mb-5"
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ color: 'var(--color-text-muted)' }}
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
                <path d="M11 8v6" />
                <path d="M8 11h6" />
              </svg>
              <p className="text-lg font-semibold mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                Ready to Audit
              </p>
              <p className="text-sm mb-5">
                Enter a URL above to analyze your site
              </p>
              <div className="flex items-center justify-center gap-2">
                <span
                  className="text-xs px-2.5 py-1 rounded-full font-medium"
                  style={{ backgroundColor: 'var(--color-accent-light)', color: 'var(--color-accent)' }}
                >
                  251 Rules
                </span>
                <span
                  className="text-xs px-2.5 py-1 rounded-full font-medium"
                  style={{ backgroundColor: 'var(--color-info-bg)', color: 'var(--color-info)' }}
                >
                  20 Categories
                </span>
                <span
                  className="text-xs px-2.5 py-1 rounded-full font-medium"
                  style={{ backgroundColor: 'var(--color-pass-bg)', color: 'var(--color-pass)' }}
                >
                  Core Web Vitals
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
