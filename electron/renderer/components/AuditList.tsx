/**
 * Table of past audits from the database.
 */

import type { AuditSummaryIpc } from '../../shared/ipc-types.js';
import { getScoreColor, formatDate } from '../lib/format.js';

interface AuditListProps {
  audits: AuditSummaryIpc[];
  loading: boolean;
  onAuditClick?: (auditId: string) => void;
}

export function AuditList({ audits, loading, onAuditClick }: AuditListProps) {
  if (loading) {
    return (
      <div className="text-center py-8 text-sm" style={{ color: 'var(--color-text-muted)' }}>
        Loading audits...
      </div>
    );
  }

  if (audits.length === 0) {
    return (
      <div className="text-center py-8 text-sm" style={{ color: 'var(--color-text-muted)' }}>
        No audits found. Run your first audit to see history here.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[var(--color-border)] overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-[var(--color-bg-hover)]">
            <th className="text-left p-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Date</th>
            <th className="text-left p-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>URL</th>
            <th className="text-center p-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Score</th>
            <th className="text-center p-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Pages</th>
            <th className="text-center p-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Results</th>
            <th className="w-10 p-3"></th>
          </tr>
        </thead>
        <tbody>
          {audits.map((audit) => {
            const scoreColor = getScoreColor(audit.overallScore);
            return (
              <tr
                key={audit.auditId}
                className="border-t border-[var(--color-border-subtle)] hover:bg-[var(--color-bg-hover)] transition-colors cursor-pointer"
                onClick={() => onAuditClick?.(audit.auditId)}
              >
                <td className="p-3" style={{ color: 'var(--color-text-secondary)' }}>
                  {formatDate(audit.startedAt)}
                </td>
                <td className="p-3 truncate max-w-xs" style={{ color: 'var(--color-text)' }}>
                  {audit.startUrl}
                </td>
                <td className="p-3 text-center">
                  <span
                    className="text-sm font-bold px-2 py-0.5 rounded-full"
                    style={{ color: scoreColor, backgroundColor: `${scoreColor}15` }}
                  >
                    {Math.round(audit.overallScore)}
                  </span>
                </td>
                <td className="p-3 text-center" style={{ color: 'var(--color-text-muted)' }}>
                  {audit.pagesAudited}
                </td>
                <td className="p-3 text-center">
                  <div className="flex items-center justify-center gap-2">
                    {audit.failedCount > 0 && (
                      <span className="text-xs" style={{ color: 'var(--color-fail)' }}>
                        {audit.failedCount}F
                      </span>
                    )}
                    {audit.warningCount > 0 && (
                      <span className="text-xs" style={{ color: 'var(--color-warn)' }}>
                        {audit.warningCount}W
                      </span>
                    )}
                    <span className="text-xs" style={{ color: 'var(--color-pass)' }}>
                      {audit.passedCount}P
                    </span>
                  </div>
                </td>
                <td className="p-3 text-center" style={{ color: 'var(--color-text-muted)' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
