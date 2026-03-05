/**
 * Hook for querying audit history from the SQLite database via IPC.
 */

import { useState, useEffect, useCallback } from 'react';
import { getAPI } from '../lib/ipc-client.js';
import type { AuditSummaryIpc, ScoreTrendPoint } from '../../shared/ipc-types.js';

export function useAuditHistory() {
  const [audits, setAudits] = useState<AuditSummaryIpc[]>([]);
  const [domains, setDomains] = useState<string[]>([]);
  const [trend, setTrend] = useState<ScoreTrendPoint[]>([]);
  const [loading, setLoading] = useState(false);

  const loadDomains = useCallback(async () => {
    try {
      const api = getAPI();
      if (!api) return;
      const result = await api.getAuditedDomains();
      setDomains(result);
    } catch {
      setDomains([]);
    }
  }, []);

  const loadAudits = useCallback(async (domain?: string) => {
    setLoading(true);
    try {
      const api = getAPI();
      if (!api) return;
      const result = await api.listAudits({ domain, limit: 50 });
      setAudits(result);
    } catch {
      setAudits([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadTrend = useCallback(async (domain: string) => {
    try {
      const api = getAPI();
      if (!api) return;
      const result = await api.getScoreTrend({ domain, limit: 20 });
      setTrend(result);
    } catch {
      setTrend([]);
    }
  }, []);

  // Load domains on mount
  useEffect(() => {
    loadDomains();
  }, [loadDomains]);

  return {
    audits,
    domains,
    trend,
    loading,
    loadDomains,
    loadAudits,
    loadTrend,
  };
}
