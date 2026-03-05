/**
 * Hook that manages the audit lifecycle via IPC.
 *
 * Subscribes to streaming progress events from the main process
 * and updates the Zustand store. Returns a clean API for components.
 */

import { useEffect, useCallback } from 'react';
import { getAPI } from '../lib/ipc-client.js';
import { useAuditStore } from '../stores/audit-store.js';

interface AuditOptions {
  measureCwv?: boolean;
  crawl?: boolean;
  maxPages?: number;
  concurrency?: number;
  categories?: string[];
}

export function useAudit() {
  const store = useAuditStore();

  // Subscribe to IPC events on mount
  useEffect(() => {
    const api = getAPI();
    if (!api) return;

    const unsubs = [
      api.onCategoryStart((data) => {
        store.setCategoryStart(data.categoryId, data.categoryName);
      }),
      api.onCategoryComplete((data) => {
        store.setCategoryComplete(data.categoryId, data.categoryName, data.result);
      }),
      api.onRuleComplete(() => {
        store.addRuleComplete();
      }),
      api.onPageComplete((data) => {
        store.setPageComplete(data.pageNumber, data.totalPages);
      }),
      api.onAuditComplete((payload) => {
        store.setComplete(payload.result, payload.ruleMetadata);
      }),
      api.onAuditError((message) => {
        store.setError(message);
      }),
    ];

    return () => unsubs.forEach((unsub) => unsub());
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const run = useCallback(
    (url: string, options: AuditOptions = {}) => {
      const api = getAPI();
      if (!api) return;
      store.startAudit(url);
      api.runAudit({ url, options });
    },
    [], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const cancel = useCallback(() => {
    const api = getAPI();
    if (!api) return;
    api.cancelAudit();
    store.reset();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    status: store.status,
    url: store.url,
    progress: store.progress,
    result: store.result,
    ruleMetadata: store.ruleMetadata,
    error: store.error,
    run,
    cancel,
    reset: store.reset,
  };
}
