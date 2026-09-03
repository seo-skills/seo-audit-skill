/**
 * Hook that manages the audit lifecycle over IPC.
 *
 * The main process streams the whole run state, so this only mirrors it into
 * the store. It also asks for the current state on mount, which is what makes
 * a window opened mid-run show the run rather than an empty form.
 */

import { useEffect, useCallback } from 'react';
import { getAPI } from '../lib/ipc-client.js';
import { useAuditStore } from '../stores/audit-store.js';
import type { AuditRunArgs } from '../../electron/shared/ipc-types.js';

export function useAudit() {
  const store = useAuditStore();

  useEffect(() => {
    const api = getAPI();
    if (!api) return;

    const { setRunState, setComplete, setError } = useAuditStore.getState();

    const unsubs = [
      api.onAuditState((state) => setRunState(state)),
      api.onAuditComplete((payload) => setComplete(payload.result, payload.ruleMetadata, payload.saveError)),
      api.onAuditError((error) => setError(error)),
    ];

    // A run may already be in progress when this window opens.
    api
      .getAuditState()
      .then((state) => setRunState(state))
      .catch(() => {
        // No state is better than a wrong one; the form just shows as idle.
      });

    return () => unsubs.forEach((unsub) => unsub());
  }, []);

  const run = useCallback(async (url: string, options: Omit<AuditRunArgs, 'url'> = {}) => {
    const api = getAPI();
    if (!api) return;
    const outcome = await api.runAudit({ url, ...options });
    if (!outcome.started && outcome.error) {
      useAuditStore.getState().setError(outcome.error);
    }
  }, []);

  const cancel = useCallback(async () => {
    const api = getAPI();
    if (!api) return;
    // The main process reports the cancellation through the state stream, so
    // the UI is not reset here — a cancelled run stays visible.
    await api.cancelAudit();
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
    reset: store.reset,
  };
}
