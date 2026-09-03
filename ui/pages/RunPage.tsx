/**
 * Running an audit.
 *
 * Electron only for now: the browser gains this in Phase 3, when the run
 * endpoints and the event stream exist. The page is written against the
 * shared run state either way, so that change is a transport swap.
 */

import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAudit } from '../hooks/useAudit.js';
import { useAppInfo } from '../hooks/useAppInfo.js';
import { AuditRunner } from '../components/AuditRunner.js';
import { ProgressStream } from '../components/ProgressStream.js';

export function RunPage() {
  const { status, run, error, saveError, runAudit, cancel, reset } = useAudit();
  const appInfo = useAppInfo();
  const navigate = useNavigate();
  const [landed, setLanded] = useState<string | null>(null);

  // A finished run belongs in the history, so send the user to the audit they
  // just produced rather than leaving them on a form with a stale result.
  useEffect(() => {
    if (status === 'complete' && run.auditId && run.auditId !== landed) {
      setLanded(run.auditId);
      navigate(`/audits/${run.auditId}`);
    }
  }, [status, run.auditId, landed, navigate]);

  const handleRun = useCallback(
    (url: string, options: { measureCwv: boolean; crawl: boolean; maxPages: number }) => {
      void runAudit(url, options);
    },
    [runAudit]
  );

  return (
    <div className="max-w-[var(--content-max-width)] mx-auto p-6 space-y-6">
      <section
        className="p-5 rounded-xl border"
        style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg-elevated)' }}
      >
        <AuditRunner isRunning={status === 'running'} onRun={handleRun} onCancel={() => void cancel()} />
      </section>

      {status === 'running' && (
        <section
          className="p-5 rounded-xl border"
          style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg-elevated)' }}
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
          className="p-4 rounded-lg border text-sm"
          style={{
            backgroundColor: 'var(--color-warn-bg)',
            borderColor: 'var(--color-warn)',
            color: 'var(--color-warn)',
          }}
        >
          This audit finished but could not be saved to your history: {saveError}
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
          {appInfo.ruleCount} rules across {appInfo.categoryCount} categories.
        </p>
      )}
    </div>
  );
}
