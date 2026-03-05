/**
 * History page — score trend chart + past audit list.
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuditHistory } from '../hooks/useAuditHistory.js';
import { useAuditStore } from '../stores/audit-store.js';
import { getAPI } from '../lib/ipc-client.js';
import { DomainPicker } from '../components/DomainPicker.js';
import { ScoreTrend } from '../components/ScoreTrend.js';
import { AuditList } from '../components/AuditList.js';

interface HistoryPageProps {
  onNavigateToAudit?: () => void;
}

export function HistoryPage({ onNavigateToAudit }: HistoryPageProps) {
  const { audits, domains, trend, loading, loadAudits, loadTrend, loadDomains } = useAuditHistory();
  const loadHistorical = useAuditStore((s) => s.loadHistorical);
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);

  const handleAuditClick = useCallback(async (auditId: string) => {
    const api = getAPI();
    if (!api) return;
    const detail = await api.getAuditDetail(auditId);
    if (!detail) return;
    loadHistorical(detail.result.url, detail.result, detail.ruleMetadata);
    onNavigateToAudit?.();
  }, [loadHistorical, onNavigateToAudit]);

  // Load audits and trend when domain selection changes
  useEffect(() => {
    loadAudits(selectedDomain ?? undefined);
    if (selectedDomain) {
      loadTrend(selectedDomain);
    }
  }, [selectedDomain, loadAudits, loadTrend]);

  // Refresh domains on mount
  useEffect(() => {
    loadDomains();
  }, [loadDomains]);

  return (
    <div className="pt-[var(--header-height)]">
      <div className="max-w-[var(--content-max-width)] mx-auto p-6 space-y-6">
        {/* Header with domain picker */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
            Audit History
          </h2>
          <DomainPicker
            domains={domains}
            selected={selectedDomain}
            onChange={setSelectedDomain}
          />
        </div>

        {/* Score trend chart */}
        {selectedDomain && (
          <div
            className="p-5 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border)]"
            style={{ boxShadow: 'var(--shadow-sm)' }}
          >
            <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text)' }}>
              Score Trend — {selectedDomain}
            </h3>
            <ScoreTrend data={trend} />
          </div>
        )}

        {/* Audit list */}
        <div
          className="p-5 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border)]"
          style={{ boxShadow: 'var(--shadow-sm)' }}
        >
          <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text)' }}>
            Past Audits
          </h3>
          <AuditList audits={audits} loading={loading} onAuditClick={handleAuditClick} />
        </div>
      </div>
    </div>
  );
}
