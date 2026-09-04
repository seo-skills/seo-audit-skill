/**
 * One stored audit.
 *
 * Score first, then what is wrong, then everything. The action bar carries
 * compare, export and delete because those are the things you want when
 * looking at a finished audit.
 */

import { useCallback, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getHost, getReads } from '../lib/api-client.js';
import { getAPI } from '../lib/ipc-client.js';
import { useAsync } from '../lib/hooks.js';
import { PageError } from '../components/PageError.js';
import { ScoreCircle } from '../components/ScoreCircle.js';
import { ScoreStats } from '../components/ScoreStats.js';
import { CategoryGrid } from '../components/CategoryGrid.js';
import { CategorySection } from '../components/CategorySection.js';
import { FilterTabs, type FilterStatus } from '../components/FilterTabs.js';
import { IssuesTable } from '../components/IssuesTable.js';
import { Sidebar } from '../components/Sidebar.js';
import { formatDate } from '../lib/format.js';

const EXPORT_FORMATS = [
  { format: 'html', label: 'HTML report' },
  { format: 'markdown', label: 'Markdown' },
  { format: 'json', label: 'JSON' },
  { format: 'llm', label: 'LLM text' },
] as const;

export function AuditDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const reads = getReads();
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const detail = useAsync(() => reads.getAuditDetail(id), [id]);

  const handleCategoryClick = useCallback((categoryId: string) => {
    setActiveCategory(categoryId);
    document.getElementById(`category-${categoryId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const handleIssueClick = useCallback((ruleId: string, categoryId: string) => {
    setActiveCategory(categoryId);
    setTimeout(() => {
      const element = document.getElementById(`rule-${ruleId}`);
      element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  }, []);

  const handleExport = useCallback(
    async (format: 'html' | 'markdown' | 'json' | 'llm') => {
      if (getHost() === 'electron') {
        // The desktop app has no download; it asks where to save instead.
        await getAPI()?.exportAudit(id, format);
        return;
      }
      window.location.href = reads.exportUrl(id, format);
    },
    [id, reads]
  );

  const handleDelete = useCallback(async () => {
    setBusy(true);
    try {
      await reads.deleteAudit(id);
      navigate('/', { replace: true });
    } finally {
      setBusy(false);
    }
  }, [id, navigate, reads]);

  if (detail.serverGone) return <PageError kind="server-gone" onRetry={detail.reload} />;
  if (!detail.loading && !detail.data) return <PageError kind="not-found" />;
  if (!detail.data) {
    return (
      <div className="max-w-[var(--content-max-width)] mx-auto p-6 text-sm" style={{ color: 'var(--color-text-muted)' }}>
        Loading audit…
      </div>
    );
  }

  const { audit, result, ruleMetadata } = detail.data;
  const totals = result.categoryResults.reduce(
    (sum, category) => ({
      pass: sum.pass + category.passCount,
      warn: sum.warn + category.warnCount,
      fail: sum.fail + category.failCount,
      notMeasured: sum.notMeasured + (category.notMeasuredCount ?? 0),
    }),
    { pass: 0, warn: 0, fail: 0, notMeasured: 0 }
  );

  const counts = {
    all: totals.pass + totals.warn + totals.fail + totals.notMeasured,
    fail: totals.fail,
    warn: totals.warn,
    pass: totals.pass,
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar
        categories={result.categoryResults}
        activeCategory={activeCategory}
        onCategoryClick={handleCategoryClick}
      />

      <div className="flex-1" style={{ marginLeft: 'var(--sidebar-width)' }}>
        <div className="max-w-[var(--content-max-width)] mx-auto p-6 space-y-6">
          <nav className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            <Link to={`/?domain=${encodeURIComponent(audit.domain)}`} className="hover:underline">
              ← {audit.domain}
            </Link>
          </nav>

          {/* Score first: the number is why anyone opened this page */}
          <section
            className="p-6 rounded-xl border flex flex-wrap items-center gap-8"
            style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg-elevated)' }}
          >
            <ScoreCircle score={result.overallScore} size={140} />
            <div className="space-y-3 min-w-0">
              <div>
                <h1 className="text-lg font-semibold truncate" style={{ color: 'var(--color-text)' }}>
                  {audit.startUrl}
                </h1>
                <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  {formatDate(audit.startedAt)} · {result.categoryResults.length} categories
                  {result.crawledPages > 1 && ` · ${result.crawledPages} pages`}
                  {audit.source && ` · ${audit.source}`}
                  {' · engine '}
                  {audit.engineVersion ?? 'unknown'}
                </p>
              </div>
              <ScoreStats
                passCount={totals.pass}
                warnCount={totals.warn}
                failCount={totals.fail}
                notMeasuredCount={totals.notMeasured}
              />
            </div>
          </section>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to={`/compare/${audit.auditId}`}
              className="px-3 py-1.5 text-sm rounded-md font-medium border"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
            >
              Compare with previous
            </Link>
            {EXPORT_FORMATS.map(({ format, label }) => (
              <button
                key={format}
                type="button"
                onClick={() => void handleExport(format)}
                className="px-3 py-1.5 text-sm rounded-md border"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => void handleDelete()}
              disabled={busy}
              className="px-3 py-1.5 text-sm rounded-md border ml-auto disabled:opacity-50"
              style={{ borderColor: 'var(--color-fail)', color: 'var(--color-fail)' }}
            >
              Delete
            </button>
          </div>

          <section
            className="p-5 rounded-xl border"
            style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg-elevated)' }}
          >
            <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text)' }}>
              Category scores
            </h2>
            <CategoryGrid
              categories={result.categoryResults}
              activeCategory={activeCategory}
              onCategoryClick={handleCategoryClick}
            />
          </section>

          {(totals.fail > 0 || totals.warn > 0) && (
            <section
              className="p-5 rounded-xl border"
              style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg-elevated)' }}
            >
              <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text)' }}>
                Issues to fix
              </h2>
              <IssuesTable result={result} ruleMetadata={ruleMetadata} onIssueClick={handleIssueClick} />
            </section>
          )}

          <section
            className="p-5 rounded-xl border"
            style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg-elevated)' }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                Detailed results
              </h2>
              <FilterTabs active={filter} counts={counts} onChange={setFilter} />
            </div>
            <div className="space-y-1">
              {result.categoryResults.map((category) => (
                <CategorySection
                  key={category.categoryId}
                  category={category}
                  filter={filter}
                  ruleMetadata={ruleMetadata}
                  defaultExpanded={
                    activeCategory === category.categoryId || (filter === 'fail' && category.failCount > 0)
                  }
                />
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
