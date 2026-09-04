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
    navigate(`/audits/${run.auditId}`, { replace: true });
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
    <div className="max-w-[var(--content-max-width)] mx-auto p-6 space-y-6">
      <section
        className="p-5 rounded-xl border"
        style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg-elevated)' }}
      >
        <AuditRunner
          isRunning={status === 'running'}
          capabilities={appInfo?.capabilities ?? null}
          initialUrl={params.get('url') ?? undefined}
          onRun={handleRun}
          onCancel={() => void cancel()}
        />
      </section>

      {status === 'running' && (
        <section
          className="p-5 rounded-xl border"
          style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg-elevated)' }}
          aria-live="polite"
          aria-busy="true"
        >
          <ProgressStream run={run} />
        </section>
      )}

      {status === 'cancelled' && (
        <div
          className="p-4 rounded-lg border flex items-center justify-between"
          style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
        >
          <p className="text-sm">Audit cancelled.</p>
          <button
            type="button"
            onClick={reset}
            className="px-3 py-1.5 text-sm rounded-md font-medium border"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
          >
            Start over
          </button>
        </div>
      )}

      {saveError && (
        <div
          className="p-4 rounded-lg border"
          style={{
            backgroundColor: 'var(--color-warn-bg)',
            borderColor: 'var(--color-warn)',
            color: 'var(--color-warn)',
          }}
          role="alert"
        >
          <p className="text-sm font-medium">This audit finished but could not be saved</p>
          <p className="text-sm mt-1 mb-3">{saveError}</p>
          <div className="flex items-center gap-2">
            {/* Export first: the result exists right now and the user should
                not lose it while working out why the save failed. */}
            {exportUrl && (
              <a
                href={exportUrl}
                className="px-3 py-1.5 text-sm rounded-md font-medium"
                style={{ backgroundColor: 'var(--color-warn)', color: '#fff' }}
              >
                Export HTML
              </a>
            )}
            <button
              type="button"
              onClick={() => void handleRetrySave()}
              disabled={savingAgain}
              className="px-3 py-1.5 text-sm rounded-md font-medium border disabled:opacity-50"
              style={{ borderColor: 'var(--color-warn)', color: 'var(--color-warn)' }}
            >
              {savingAgain ? 'Saving…' : 'Retry save'}
            </button>
          </div>
        </div>
      )}

      {status === 'error' && error && (
        <div
          className="p-4 rounded-lg border flex items-start justify-between gap-4"
          style={{
            backgroundColor: 'var(--color-fail-bg)',
            borderColor: 'var(--color-fail)',
            color: 'var(--color-fail)',
          }}
          role="alert"
        >
          <div>
            <p className="font-medium">Audit failed</p>
            <p className="text-sm mt-1">{error.message}</p>
            {error.hint && <p className="text-sm mt-1 opacity-80">{error.hint}</p>}
          </div>
          <button
            type="button"
            onClick={reset}
            className="px-3 py-1.5 text-sm rounded-md font-medium shrink-0"
            style={{ backgroundColor: 'var(--color-fail)', color: '#fff' }}
          >
            Try again
          </button>
        </div>
      )}

      {status === 'idle' && appInfo && (
        <p className="text-center text-sm py-8" style={{ color: 'var(--color-text-muted)' }}>
          {appInfo.ruleCount} rules across {appInfo.categoryCount} categories
          {getHost() === 'web' && ' · results are saved to your history'}.
        </p>
      )}
    </div>
  );
}
