/**
 * Running an audit, and watching it happen.
 *
 * Two phases with different shapes: a crawl discovers pages (an unknown total
 * that grows), then every page is scored (a known total). Showing one bar for
 * both is what made the old display sit at 0% and then jump to done.
 */

import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAudit } from '../hooks/useAudit.js';
import { useAppInfo } from '../hooks/useAppInfo.js';
import { getHost, getRuns } from '../lib/api-client.js';
import { AuditRunner } from '../components/AuditRunner.js';
import { ProgressStream } from '../components/ProgressStream.js';
import { Agent } from '../components/Logo.js';
import type { AuditRunArgs } from '../../electron/shared/ipc-types.js';

export function RunPage() {
  const { status, run, error, saveError, runAudit, cancel, retrySave, reset } = useAudit();
  const appInfo = useAppInfo();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  // Which run this page watched start. Only that one earns the automatic
  // hand-off to its result: without this, returning to /run after an audit
  // finished bounced straight back to it, so a second audit could never be
  // started.
  const [watching, setWatching] = useState<string | null>(null);
  const [savingAgain, setSavingAgain] = useState(false);

  useEffect(() => {
    if (status === 'running' && run.runId && run.runId !== watching) {
      setWatching(run.runId);
    }
  }, [status, run.runId, watching]);

  // A finished run belongs in the history, so send the user to the audit they
  // just produced rather than leaving them on a form with a stale result.
  useEffect(() => {
    if (status !== 'complete' || !run.auditId || run.runId !== watching) return;
    setWatching(null);
    // The report greets a fresh run once (the agent's alert or delighted state)
    navigate(`/audits/${run.auditId}`, { replace: true, state: { fromRun: true } });
  }, [status, run.auditId, run.runId, watching, navigate]);

  // The document title carries progress, so a backgrounded tab still says how
  // far along the audit is.
  useEffect(() => {
    if (status !== 'running') {
      document.title = 'SEOmator';
      return;
    }
    const crawling = run.phase === 'crawling' && run.crawl;
    document.title = crawling
      ? `Crawling ${run.crawl!.crawled}… · SEOmator`
      : `Auditing ${run.pages.completed}/${run.pages.total || 1} · SEOmator`;
    return () => {
      document.title = 'SEOmator';
    };
  }, [status, run.phase, run.crawl, run.pages.completed, run.pages.total]);

  const handleRun = useCallback(
    (url: string, options: Omit<AuditRunArgs, 'url'>) => {
      void runAudit(url, options);
    },
    [runAudit]
  );

  const handleRetrySave = useCallback(async () => {
    setSavingAgain(true);
    try {
      await retrySave();
    } finally {
      setSavingAgain(false);
    }
  }, [retrySave]);

  const exportUrl = run.runId ? getRuns().exportUrl(run.runId, 'html') : null;

  return (
    <div className="max-w-[var(--content-max-width)] mx-auto px-4 md:px-6">
      {status === 'running' ? (
        <section aria-busy="true" className="border-b border-[var(--color-border)]">
          <ProgressStream run={run} onStop={() => void cancel()} />
        </section>
      ) : (
        <section className="border-b border-[var(--color-border)]">
          <AuditRunner
            isRunning={false}
            capabilities={appInfo?.capabilities ?? null}
            categories={appInfo?.categories ?? null}
            initialUrl={params.get('url') ?? run.url ?? undefined}
            // "Run again" and the render hint carry the stored run options
            initialOptions={{
              ...(params.get('render') === '1' && { measureCwv: true }),
              ...(params.get('crawl') === '1' && { crawl: true }),
              ...(Number(params.get('maxPages')) > 0 && { maxPages: Number(params.get('maxPages')) }),
            }}
            header={
              <>
                <div className="flex items-center gap-2.5 mb-6">
                  <Agent state="idle" size={40} />
                  <span className="agent-say">
                    {appInfo
                      ? `${appInfo.ruleCount} checks across ${appInfo.categoryCount} categories${getHost() === 'web' ? ', saved to your history' : ''}.`
                      : 'Waiting for a URL.'}
                  </span>
                </div>
                <h1 className="text-[32px] leading-[36px] lg:text-[40px] lg:leading-[44px] font-semibold tracking-[-0.02em] mb-6">
                  Run an audit
                </h1>
              </>
            }
            onRun={handleRun}
            onCancel={() => void cancel()}
          />
        </section>
      )}

      <div className="py-6 space-y-3 empty:hidden">
        {status === 'cancelled' && (
          <div className="tbl flex items-center justify-between gap-3 px-4 py-3">
            <p className="text-[13px] text-[var(--color-text-secondary)]">Audit stopped. Nothing was saved.</p>
            <button type="button" onClick={reset} className="btn">
              Start over
            </button>
          </div>
        )}

        {saveError && (
          <div className="tbl px-4 py-3" role="alert" style={{ borderColor: 'var(--color-warn)' }}>
            <p className="text-sm font-medium" style={{ color: 'var(--color-warn)' }}>This audit finished but could not be saved</p>
            <p className="text-[13px] mt-1 mb-3 text-[var(--color-text-secondary)]">{saveError}</p>
            <div className="flex items-center gap-2">
              {/* Export first: the result exists right now and the user should
                  not lose it while working out why the save failed. */}
              {exportUrl && (
                <a href={exportUrl} className="btn btn-primary">
                  Export HTML
                </a>
              )}
              <button type="button" onClick={() => void handleRetrySave()} disabled={savingAgain} className="btn">
                {savingAgain ? 'Saving…' : 'Retry save'}
              </button>
            </div>
          </div>
        )}

        {status === 'error' && error && (
          <div className="tbl flex items-start justify-between gap-4 px-4 py-3" role="alert" style={{ borderColor: 'var(--color-fail)' }}>
            <div>
              <p className="font-medium" style={{ color: 'var(--color-fail)' }}>Audit failed</p>
              <p className="text-[13px] mt-1 text-[var(--color-text-secondary)]">{error.message}</p>
              {error.hint && <p className="text-[13px] mt-1 text-[var(--color-text-muted)]">{error.hint}</p>}
            </div>
            <button type="button" onClick={reset} className="btn shrink-0">
              Try again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
