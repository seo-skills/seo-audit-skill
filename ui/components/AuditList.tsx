/**
 * Table of past audits from the database.
 */

import { Link } from 'react-router-dom';
import type { AuditSummaryDto } from '../../electron/shared/ipc-types.js';
import { formatDate, verdictStyle } from '../lib/format.js';

interface AuditListProps {
  audits: AuditSummaryDto[];
  loading: boolean;
  /** Where a row goes. A real link, so Cmd-click and the keyboard work. */
  linkTo: (auditId: string) => string;
}

export function AuditList({ audits, loading, linkTo }: AuditListProps) {
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
    // The table keeps its column widths, so on a narrow screen it scrolls
    // inside this box rather than widening the page.
    <div className="rounded-lg border border-[var(--color-border)] overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-[var(--color-bg-hover)]">
            <th className="text-left p-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Date</th>
            <th className="text-left p-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>URL</th>
            <th className="text-center p-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Score</th>
            <th className="text-center p-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Pages</th>
            <th className="text-right p-3 font-medium" style={{ color: 'var(--color-fail)' }}>Failed</th>
            <th className="text-right p-3 font-medium" style={{ color: 'var(--color-warn)' }}>Warnings</th>
            <th className="text-right p-3 font-medium" style={{ color: 'var(--color-pass)' }}>Passed</th>
            <th className="w-10 p-3"></th>
          </tr>
        </thead>
        <tbody>
          {audits.map((audit) => {
            return (
              <tr
                key={audit.auditId}
                className="row-link cursor-pointer border-t border-[var(--color-border-subtle)] hover:bg-[var(--color-bg-hover)] transition-colors"
              >
                <td className="p-0" style={{ color: 'var(--color-text-secondary)' }}>
                  {/* One link, stretched over the whole row by `.row-link`, so
                      every part of the row navigates while keyboard focus stays
                      a single tab stop and cmd-click still opens a new tab. */}
                  <Link
                    to={linkTo(audit.auditId)}
                    aria-label={`Audit of ${audit.startUrl} on ${formatDate(audit.startedAt)}, score ${Math.round(audit.overallScore)}`}
                    className="row-link-target block p-3 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--color-accent)]"
                  >
                    {formatDate(audit.startedAt)}
                  </Link>
                </td>
                <td className="p-3 truncate max-w-xs" style={{ color: 'var(--color-text)' }}>
                  {audit.startUrl}
                </td>
                <td className="p-3 text-center">
                  <span
                    className="text-sm font-bold px-2 py-0.5 rounded-full"
                    style={verdictStyle(audit.overallScore)}
                  >
                    {Math.round(audit.overallScore)}
                  </span>
                </td>
                <td className="p-3 text-center" style={{ color: 'var(--color-text-muted)' }}>
                  {audit.pagesAudited}
                </td>
                {/* Three columns under three headers, so the number is read
                    against a word rather than a suffix letter and a colour.
                    A zero shows as a dash: absent is a result, and an empty
                    cell reads as missing data. */}
                <td className="p-3 text-right tabular-nums" style={{ color: audit.failedCount > 0 ? 'var(--color-fail)' : 'var(--color-text-muted)' }}>
                  {audit.failedCount > 0 ? audit.failedCount : '—'}
                </td>
                <td className="p-3 text-right tabular-nums" style={{ color: audit.warningCount > 0 ? 'var(--color-warn)' : 'var(--color-text-muted)' }}>
                  {audit.warningCount > 0 ? audit.warningCount : '—'}
                </td>
                <td className="p-3 text-right tabular-nums" style={{ color: 'var(--color-pass)' }}>
                  {audit.passedCount}
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
