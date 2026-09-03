/**
 * One stored audit.
 *
 * Score first, then what is wrong, then everything. The action bar carries
 * compare, export and delete because those are the things you want when
 * looking at a finished audit.
 */

import { useCallback, useLayoutEffect, useState } from 'react';
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
import { CategoryRow } from '../components/CategoryRow.js';
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
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const detail = useAsync(() => reads.getAuditDetail(id), [id]);

  const handleCategoryClick = useCallback((categoryId: string) => {
    setActiveCategory(categoryId);
    document.getElementById(`category-${categoryId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  // Expanding the category and jumping to the rule are one action, but they
  // happen in two renders: the element does not exist until React has committed
  // the expansion. This used to guess with `setTimeout(..., 100)`, so on a slow
  // machine the scroll found nothing and silently did nothing.
  const [pendingReveal, setPendingReveal] = useState<string | null>(null);

  const handleIssueClick = useCallback((ruleId: string, categoryId: string) => {
    setActiveCategory(categoryId);
    setPendingReveal(ruleId);
  }, []);

  useLayoutEffect(() => {
    if (pendingReveal === null) return;
    const element = document.getElementById(`rule-${pendingReveal}`);
    setPendingReveal(null);
    if (!element) return;

    // An explicit `behavior` overrides the CSS that honours the preference, so
    // the preference has to be read here too.
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    element.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
    // Focus follows the eye. Without this the view moved and the keyboard did
    // not, so Tab resumed from the table and a screen reader said nothing.
    element.focus({ preventScroll: true });
  }, [pendingReveal, activeCategory]);

  const handleExport = useCallback(
    async (format: 'html' | 'markdown' | 'json' | 'llm') => {
      setActionError(null);
      if (getHost() === 'electron') {
        // The desktop app has no download; it asks where to save instead, and
        // that can fail — no permission, no disk, cancelled dialog. Failing
        // silently leaves the user believing they have a file they do not.
        setBusy(true);
        try {
          await getAPI()?.exportAudit(id, format);
        } catch (cause) {
          setActionError(cause instanceof Error ? cause.message : 'The export failed.');
        } finally {
          setBusy(false);
        }
        return;
      }
      window.location.href = reads.exportUrl(id, format);
    },
    [id, reads]
  );

  const handleDelete = useCallback(async () => {
    setBusy(true);
    setActionError(null);
    try {
      await reads.deleteAudit(id);
      navigate('/', { replace: true });
    } catch (cause) {
      // The audit is still there. Say so, rather than resetting the button and
      // leaving the user to guess whether it worked.
      setActionError(cause instanceof Error ? cause.message : 'The audit could not be deleted.');
      setConfirmingDelete(false);
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

      {/* The rail only exists at lg and above, so the offset does too. */}
      <div className="flex-1 min-w-0 lg:ml-[var(--sidebar-width)]">
        <div className="max-w-[var(--content-max-width)] min-w-0 mx-auto p-6 space-y-6">
          <nav className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            <Link to={`/?domain=${encodeURIComponent(audit.domain)}`} className="hover:underline">
              ← {audit.domain}
            </Link>
          </nav>

          <CategoryRow
            categories={result.categoryResults}
            activeCategory={activeCategory}
            onCategoryClick={handleCategoryClick}
          />

          {/* Score first: the number is why anyone opened this page */}
          <section
            className="p-6 rounded-xl border flex flex-wrap items-center gap-8"
            style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg-elevated)' }}
          >
            <ScoreCircle score={result.overallScore} size={140} />
            <div className="space-y-3 min-w-0">
              <div>
                <h1 className="text-xl font-semibold truncate" style={{ color: 'var(--color-text)' }}>
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
              to={`/run?url=${encodeURIComponent(audit.startUrl)}`}
              className="px-3 py-1.5 text-sm rounded-md font-medium"
              style={{ backgroundColor: 'var(--color-accent)', color: 'var(--color-on-accent)' }}
            >
              Run again
            </Link>
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
            {confirmingDelete ? (
              <span className="flex items-center gap-2 ml-auto">
                <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  Delete this audit permanently?
                </span>
                <button
                  type="button"
                  onClick={() => void handleDelete()}
                  disabled={busy}
                  autoFocus
                  className="px-3 py-1.5 text-sm rounded-md font-medium disabled:opacity-50"
                  style={{ backgroundColor: 'var(--color-fail)', color: 'var(--color-on-accent)' }}
                >
                  {busy ? 'Deleting…' : 'Delete'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(false)}
                  disabled={busy}
                  className="px-3 py-1.5 text-sm rounded-md border disabled:opacity-50"
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                >
                  Keep
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                disabled={busy}
                className="px-3 py-1.5 text-sm rounded-md border ml-auto disabled:opacity-50"
                style={{ borderColor: 'var(--color-fail)', color: 'var(--color-fail)' }}
              >
                Delete
              </button>
            )}
          </div>

          {actionError && (
            <div
              role="alert"
              className="px-3 py-2 rounded-md border text-sm"
              style={{
                borderColor: 'var(--color-fail)',
                backgroundColor: 'var(--color-fail-bg)',
                color: 'var(--color-fail)',
              }}
            >
              {actionError}
            </div>
          )}

          <section
            className="p-5 rounded-xl border"
            style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg-elevated)' }}
          >
            <h2 className="text-base font-semibold mb-3" style={{ color: 'var(--color-text)' }}>
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
              <h2 className="text-base font-semibold mb-3" style={{ color: 'var(--color-text)' }}>
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
              <h2 className="text-base font-semibold" style={{ color: 'var(--color-text)' }}>
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
