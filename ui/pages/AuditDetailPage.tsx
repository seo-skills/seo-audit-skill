/**
 * One stored audit, as the Fix Brief (DESIGN.md).
 *
 * The first fix is the headline and the score sits beside it; then the rest of
 * the fixes in the order that returns the most points, where those points
 * went, what could not be measured, and every check. The action bar keeps one
 * orange button, Run again; export and delete sit in menus.
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { getHost, getReads } from '../lib/api-client.js';
import { getAPI } from '../lib/ipc-client.js';
import { useAsync } from '../lib/hooks.js';
import { PageError } from '../components/PageError.js';
import { CategorySection } from '../components/CategorySection.js';
import { FilterTabs, type FilterStatus } from '../components/FilterTabs.js';
import { formatDate } from '../lib/format.js';
import { SiteSection } from '../components/SiteSection.js';
import { CustomChecksSection } from '../components/CustomChecksSection.js';
import { LeadFix } from '../components/LeadFix.js';
import { ScorePanel } from '../components/ScorePanel.js';
import { FixQueue } from '../components/FixQueue.js';
import { PointsStrip } from '../components/PointsStrip.js';
import { MeasurementGaps, NumbersNote } from '../components/ReportNotes.js';
import { Menu } from '../components/Menu.js';
import { CATEGORY_NAMES, missingPoints, rankedFixes, type Fix } from '../lib/fixes.js';
import { advisoryCount, completionLabel, coverageText, notMeasuredByReason, renderHint, rerunHref } from '../lib/audit-state.js';

const EXPORT_FORMATS = [
  { format: 'html', label: 'HTML report', hint: '.html' },
  { format: 'markdown', label: 'Markdown', hint: '.md' },
  { format: 'json', label: 'JSON', hint: '.json' },
  { format: 'llm', label: 'LLM text', hint: '.txt' },
] as const;

export function AuditDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const fromRun = Boolean((location.state as { fromRun?: boolean } | null)?.fromRun);
  const reads = getReads();
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyFormat, setBusyFormat] = useState<string | null>(null);

  const detail = useAsync(() => reads.getAuditDetail(id), [id]);

  // The first audit of a site has nothing to compare with; that is not an error.
  const comparison = useAsync(() => reads.compare(id).catch(() => null), [id]);
  const [stripCategory, setStripCategory] = useState<string | null>(null);
  // Expand all / Collapse all over every category in All checks
  const [force, setForce] = useState<{ expanded: boolean; nonce: number }>({ expanded: false, nonce: 0 });
  const fixes = useMemo(
    () => (detail.data ? rankedFixes(detail.data.result, detail.data.ruleMetadata) : []),
    [detail.data]
  );

  // History keeps `state` across a reload, so the arrival reaction would
  // replay; drop the flag once the reaction has had time to play.
  useEffect(() => {
    // Wait for both reads: the reaction is chosen from them.
    if (!fromRun || detail.loading || comparison.loading) return;
    const timer = window.setTimeout(
      () => navigate(`${location.pathname}${location.search}${location.hash}`, { replace: true, state: null }),
      1200
    );
    return () => window.clearTimeout(timer);
  }, [fromRun, detail.loading, comparison.loading, navigate, location.pathname, location.search, location.hash]);

  // Expanding the category and jumping to the rule are one action, but they
  // happen in two renders: the element does not exist until React has committed
  // the expansion. This used to guess with `setTimeout(..., 100)`, so on a slow
  // machine the scroll found nothing and silently did nothing.
  const [pendingReveal, setPendingReveal] = useState<string | null>(null);

  const handleIssueClick = useCallback((ruleId: string, categoryId: string) => {
    // Clearing the filter is part of the same action. The summary table always
    // lists the top findings regardless of the active filter, so clicking a
    // warning while filtered to Failures asked the page to reveal a rule the
    // filter had just removed from the DOM — the jump found nothing and did
    // nothing, for the same reason the collapsed category used to.
    setFilter('all');
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

    // The URL names what is on screen, so this view can be shared or reloaded
    // back to the same finding. `replaceState` rather than a router navigation:
    // revealing a rule is not a new page, and it should not take a Back press
    // to undo.
    window.history.replaceState(null, '', `#rule-${pendingReveal}`);
  }, [pendingReveal, activeCategory]);

  // A link straight to a finding — from a shared URL, or a reload — has to do
  // the same reveal, and the hash alone cannot expand the category holding it.
  const revealFromHash = useCallback(() => {
    const ruleId = window.location.hash.replace(/^#rule-/, '');
    if (!ruleId || ruleId === window.location.hash) return;
    const category = detail.data?.result.categoryResults.find((c) =>
      c.results.some((r) => r.ruleId === ruleId)
    );
    if (!category) return;
    setFilter('all');
    setActiveCategory(category.categoryId);
    setPendingReveal(ruleId);
  }, [detail.data]);

  useEffect(() => {
    revealFromHash();
  }, [revealFromHash]);

  const handleExport = useCallback(
    async (format: 'html' | 'markdown' | 'json' | 'llm') => {
      setActionError(null);
      if (getHost() === 'electron') {
        // The desktop app has no download; it asks where to save instead, and
        // that can fail — no permission, no disk, cancelled dialog. Failing
        // silently leaves the user believing they have a file they do not.
        setBusyFormat(format);
        try {
          await getAPI()?.exportAudit(id, format);
        } catch (cause) {
          setActionError(cause instanceof Error ? cause.message : 'The export failed.');
        } finally {
          setBusyFormat(null);
        }
        return;
      }
      // A download the browser starts gives no completion event, so there is
      // nothing honest to report as success. What it can do is stop looking
      // inert: the button says it is working for long enough to be seen, which
      // is the whole complaint — clicking Markdown looked like nothing
      // happened, because on a fast download nothing visible does.
      setBusyFormat(format);
      window.location.href = reads.exportUrl(id, format);
      window.setTimeout(() => setBusyFormat(null), 1200);
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
  if (detail.stale) return <PageError kind="stale-session" />;
  if (!detail.loading && !detail.data) return <PageError kind="not-found" />;
  if (!detail.data) return <ReportSkeleton />;

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
    notmeasured: totals.notMeasured,
  };

  // Rule-level counts for the score panel: one per check, not one per page
  const summaries = result.categoryResults.flatMap((category) => category.results);
  const advisory = advisoryCount(result);
  const notMeasuredRules = notMeasuredByReason(result).reduce((sum, group) => sum + group.ruleIds.length, 0);
  const scoredRules = summaries.filter(
    (rule) => !rule.advisory && (rule.status === 'pass' || rule.status === 'warn' || rule.status === 'fail')
  ).length;
  const missing = missingPoints(fixes);
  const crawl = result.crawledPages > 1;
  // A stored audit keeps its run options on the audit row, not on the result;
  // reading only `result.run` lost them, so "Run again" dropped the render.
  const measured = result.run ? result : { ...result, ...(audit.run && { run: audit.run }) };
  const rendered = Boolean(measured.run?.measureCwv);
  const coverage = coverageText(result);
  const hintText = renderHint(result, true);
  const hint = hintText ? { text: hintText, href: rerunHref(audit.startUrl, measured, true) } : null;
  const reveal = (fix: Fix) => handleIssueClick(fix.ruleId, fix.categoryId);
  const picked = stripCategory ? { id: stripCategory, name: CATEGORY_NAMES[stripCategory] ?? stripCategory } : null;
  // A run that just finished gets one reaction: delighted when the score went
  // up, alert when it found failures. Decided once the comparison has loaded.
  const greet = !fromRun || comparison.loading
    ? undefined
    : (comparison.data?.scoreDelta ?? 0) > 0
      ? 'delighted'
      : fixes.some((fix) => fix.status === 'fail')
        ? 'alert'
        : undefined;

  return (
    <div className="max-w-[var(--content-max-width)] mx-auto px-4 md:px-6">
      <div className="flex flex-wrap items-center gap-2 py-4">
        <Link
          to={`/?domain=${encodeURIComponent(audit.domain)}`}
          className="text-[13px] text-[var(--color-text-muted)] hover:text-[var(--color-text)] mr-auto"
        >
          ← {audit.domain} history
        </Link>
        <Link to={`/compare/${audit.auditId}`} className="btn btn-ghost">
          Compare with previous
        </Link>
        <Menu
          label="Export"
          button={
            <>
              {busyFormat ? 'Preparing…' : 'Export'}
              <svg viewBox="0 0 10 10" width="10" height="10" aria-hidden="true">
                <path d="M2 4l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.4" />
              </svg>
            </>
          }
          items={EXPORT_FORMATS.map(({ format, label, hint: ext }) => ({
            label,
            hint: ext,
            disabled: busyFormat !== null,
            onSelect: () => void handleExport(format),
          }))}
        />
        <Menu
          label="More actions"
          className="btn btn-icon"
          button={<span aria-hidden="true">⋯</span>}
          items={[
            ...(getHost() === 'web'
              ? [{ label: 'Copy link', onSelect: () => void navigator.clipboard?.writeText(window.location.href).catch(() => {}) }]
              : []),
            { label: 'Delete audit…', danger: true, onSelect: () => setConfirmingDelete(true) },
          ]}
        />
        <Link to={rerunHref(audit.startUrl, measured)} className="btn btn-primary">
          Run again
        </Link>
      </div>

      {confirmingDelete && (
        <div role="alertdialog" aria-label="Delete this audit" className="tbl flex flex-wrap items-center gap-3 px-3 py-2 mb-3">
          <span className="text-[13px] mr-auto">Delete this audit permanently? It cannot be undone.</span>
          <button
            type="button"
            onClick={() => void handleDelete()}
            disabled={busy}
            autoFocus
            className="btn"
            style={{ backgroundColor: 'var(--color-fail)', borderColor: 'var(--color-fail)', color: 'var(--color-on-accent)' }}
          >
            {busy ? 'Deleting…' : 'Delete'}
          </button>
          <button type="button" onClick={() => setConfirmingDelete(false)} disabled={busy} className="btn btn-ghost">
            Keep
          </button>
        </div>
      )}

      {actionError && (
        <div role="alert" className="tbl px-3 py-2 mb-3 text-[13px]" style={{ borderColor: 'var(--color-fail)', color: 'var(--color-fail)' }}>
          {actionError}
        </div>
      )}

      <header className="pt-1 pb-5 border-b border-[var(--color-border)]">
        <h1 className="text-xl leading-7 font-semibold [overflow-wrap:anywhere]">{audit.domain}</h1>
        <p className="mt-1 figure text-xs text-[var(--color-text-muted)] [overflow-wrap:anywhere]">
          {audit.startUrl} · {formatDate(audit.startedAt)} · {result.crawledPages.toLocaleString()} page{result.crawledPages === 1 ? '' : 's'}
          {' · '}
          {rendered ? 'rendered in a browser' : 'not rendered'} · engine {audit.engineVersion ?? 'unknown'} ·{' '}
          {(scoredRules + notMeasuredRules).toLocaleString()} checks
        </p>
      </header>

      <section aria-label="What to fix first" className="grid lg:grid-cols-[8fr_4fr] border-b border-[var(--color-border)]">
        <div className="py-7 min-w-0 self-start">
          <LeadFix fixes={fixes} result={result} notMeasured={notMeasuredRules} onShowEvidence={reveal} greet={greet} />
        </div>
        <div className="min-w-0 border-t lg:border-t-0 lg:border-l border-[var(--color-border)]">
          <ScorePanel
            result={result}
            auditId={audit.auditId}
            missing={missing}
            scored={scoredRules}
            notMeasured={notMeasuredRules}
            advisory={advisory}
            comparison={comparison.data ?? null}
            completion={coverage ? `${completionLabel(result)} · ${coverage}` : completionLabel(result)}
            hint={hint}
            fixes={fixes}
            arriving={fromRun}
          />
        </div>
      </section>

      {fixes.length > 1 || stripCategory ? (
        <FixQueue
          fixes={fixes}
          crawl={crawl}
          capped={Boolean(result.scoreCap)}
          category={picked}
          onClearCategory={() => setStripCategory(null)}
          onReveal={reveal}
        />
      ) : null}

      {detail.data.categoryWeights && (
        <PointsStrip
          categories={result.categoryResults}
          weights={detail.data.categoryWeights}
          fixes={fixes}
          active={stripCategory}
          onPick={(categoryId) => {
            setStripCategory(categoryId);
            const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
            if (categoryId) document.getElementById('fix-queue')?.scrollIntoView({ block: 'center', behavior: reduced ? 'auto' : 'smooth' });
          }}
        />
      )}

      <MeasurementGaps result={result} advisory={advisory} />

      <div className="pt-10 empty:hidden">
        <SiteSection result={result} />
      </div>

      <section aria-labelledby="all-checks" className="pt-10">
        {/* Pinned under the app bar while the reader is in the list: with a
            category open, the filters used to scroll away with the heading. */}
        <div className="sticky top-[var(--header-height)] z-10 -mx-4 md:-mx-6 px-4 md:px-6 py-3 mb-3 flex flex-wrap items-center gap-3 bg-[var(--color-bg)] border-b border-[var(--color-border)]">
          <h3 id="all-checks" className="text-xl leading-7 font-semibold tracking-[-0.01em] mr-auto">All checks</h3>
          <FilterTabs active={filter} counts={counts} onChange={setFilter} />
          <button
            type="button"
            className="btn"
            onClick={() => setForce((f) => ({ expanded: !f.expanded, nonce: f.nonce + 1 }))}
          >
            {force.expanded ? 'Collapse all' : 'Expand all'}
          </button>
        </div>
        {/* Every CategorySection returns null when nothing in it matches
            the filter, which is right per category and left the page as a
            heading and a row of tabs over empty space. */}
        {counts[filter] === 0 ? (
          <NoMatchingChecks filter={filter} onClear={() => setFilter('all')} />
        ) : (
          <div className="space-y-1">
            {result.categoryResults.map((category) => (
              <CategorySection
                key={category.categoryId}
                category={category}
                filter={filter}
                ruleMetadata={ruleMetadata}
                multiPage={crawl}
                force={force}
                // A filter opens the categories that have what it shows
                defaultExpanded={
                  activeCategory === category.categoryId ||
                  (filter === 'fail' && category.failCount > 0) ||
                  (filter === 'warn' && category.warnCount > 0) ||
                  (filter === 'notmeasured' && (category.notMeasuredCount ?? 0) > 0)
                }
              />
            ))}
          </div>
        )}
      </section>

      <CustomChecksSection result={result} />

      <NumbersNote result={measured} missing={missing} fixCount={fixes.length} engineVersion={audit.engineVersion} />
    </div>
  );
}

/**
 * The report's shape while it loads: the lead, the score and the first rows,
 * so the page does not jump when the audit arrives. Shown only after 200ms —
 * a local read is usually faster, and a skeleton that flashes is worse than
 * none.
 */
function ReportSkeleton() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setVisible(true), 200);
    return () => window.clearTimeout(id);
  }, []);
  if (!visible) return <div className="min-h-[60vh]" aria-busy="true" />;
  const bar = 'block bg-[var(--color-bg-hover)] rounded-[2px]';
  return (
    <div className="max-w-[var(--content-max-width)] mx-auto px-4 md:px-6" aria-busy="true" aria-label="Loading the audit">
      <div className="py-4 flex justify-end gap-2">
        <span className={`${bar} w-24 h-8`} /><span className={`${bar} w-24 h-8`} />
      </div>
      <div className="pb-5 border-b border-[var(--color-border)] space-y-2">
        <span className={`${bar} w-48 h-6`} /><span className={`${bar} w-96 h-3`} />
      </div>
      <div className="grid lg:grid-cols-[8fr_4fr] border-b border-[var(--color-border)]">
        <div className="py-7 pl-[26px] space-y-4">
          <span className={`${bar} w-80 h-4`} /><span className={`${bar} w-[28rem] max-w-full h-10`} /><span className={`${bar} w-[32rem] max-w-full h-4`} />
        </div>
        <div className="py-7 lg:pl-8 space-y-3">
          <span className={`${bar} w-28 h-14`} /><span className={`${bar} w-full h-2`} />
        </div>
      </div>
      <div className="pt-10 space-y-2">
        {[0, 1, 2, 3].map((i) => <span key={i} className={`${bar} w-full h-12`} />)}
      </div>
    </div>
  );
}

/** The filter matched nothing — which is often the best news the page can give */
function NoMatchingChecks({
  filter,
  onClear,
}: {
  filter: FilterStatus;
  onClear: () => void;
}) {
  // "No failures" is good news and should read like it. "No passing checks" is
  // not, so the same empty state should not congratulate the reader for it.
  const good = filter === 'fail' || filter === 'warn';
  const label =
    filter === 'fail' ? 'failures' : filter === 'warn' ? 'warnings' : filter === 'notmeasured' ? 'unmeasured checks' : 'passing checks';

  return (
    <div className="tbl p-10 text-center">
      <p className="text-base font-semibold mb-1">
        No {label}
      </p>
      <p className="text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>
        {good
          ? 'Nothing in this audit needs attention at that level.'
          : 'Nothing in this audit matched that filter.'}
      </p>
      <button
        type="button"
        onClick={onClear}
        className="btn"
      >
        Show all checks
      </button>
    </div>
  );
}
