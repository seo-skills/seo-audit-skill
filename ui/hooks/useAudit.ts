/**
 * The run, in whichever host this is.
 *
 * The main process (Electron) or the server (web) owns the run and streams its
 * whole state; this mirrors it into the store. It also asks for the current
 * state on mount, which is what makes a tab opened — or reloaded — mid-run
 * show the run rather than an empty form.
 */

import { useCallback, useEffect } from 'react';
import { getRuns } from '../lib/api-client.js';
import { useAuditStore } from '../stores/audit-store.js';
import type { AuditRunArgs } from '../../electron/shared/ipc-types.js';

export function useAudit() {
  const store = useAuditStore();

  useEffect(() => {
    const runs = getRuns();
    const { setRunState } = useAuditStore.getState();

    const unsubscribe = runs.subscribe(setRunState);

    // A run may already be in progress when this tab opens. Under SSE the
    // snapshot covers it, but the Electron bridge and a first paint before the
    // stream connects do not.
    runs
      .getState()
      .then((state) => {
        if (state) setRunState(state);
      })
      .catch(() => {
        // No state is better than a wrong one; the form shows as idle.
      });

    return unsubscribe;
  }, []);

  const run = useCallback(async (url: string, options: Omit<AuditRunArgs, 'url'> = {}) => {
    try {
      await getRuns().start({ url, ...options });
    } catch (error) {
      useAuditStore.getState().setError({
        code: 'unknown',
        message: error instanceof Error ? error.message : 'The audit could not be started.',
      });
    }
  }, []);

  const cancel = useCallback(async () => {
    // The cancellation comes back through the state stream, so the UI is not
    // reset here — a cancelled run stays visible.
    await getRuns().cancel();
  }, []);

  const retrySave = useCallback(async () => {
    const { run: state } = useAuditStore.getState();
    if (!state.runId) return;
    const { auditId } = await getRuns().retrySave(state.runId);
    useAuditStore.setState((current) => ({
      run: { ...current.run, auditId },
      saveError: null,
    }));
  }, []);

  return {
    status: store.run.status,
    url: store.run.url,
    run: store.run,
    result: store.result,
    ruleMetadata: store.ruleMetadata,
    saveError: store.saveError,
    error: store.run.error,
    runAudit: run,
    cancel,
    retrySave,
    reset: store.reset,
  };
}
