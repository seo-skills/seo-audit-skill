/**
 * Table of past audits from the database.
 */

import { Link } from 'react-router-dom';
import type { AuditSummaryDto } from '../../electron/shared/ipc-types.js';
import { formatDate, getScoreColor } from '../lib/format.js';
import { StatusShape } from './Status.js';
import { ScoreMeter } from './ScoreMeter.js';

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
    // A ledger (DESIGN.md): ink counts with separators, status shapes in the
    // headers, and colour on the score only when it is under 80. The table
    // keeps its column widths, so on a narrow screen it scrolls inside this
    // box rather than widening the page.
    <div className="overflow-x-auto">
      <table className="tbl text-sm">
        <thead>
          <tr>
            <th>When</th>
            <th>URL</th>
            <th className="num">Score</th>
            <th className="num">Pages</th>
            <th className="num">
              <span className="status justify-end"><StatusShape status="fail" /><span>Fails</span></span>
            </th>
            <th className="num">
              <span className="status justify-end"><StatusShape status="warn" /><span>Warnings</span></span>
            </th>
            <th className="w-10" aria-hidden="true"></th>
          </tr>
        </thead>
        <tbody>
          {audits.map((audit) => (
            <tr key={audit.auditId} className="row-link cursor-pointer hover:bg-[var(--color-bg-hover)] transition-colors">
              <td className="p-0 figure text-[13px] text-[var(--color-text-muted)] whitespace-nowrap">
                {/* One link, stretched over the whole row by `.row-link`, so
                    every part of the row navigates while keyboard focus stays
                    a single tab stop and cmd-click still opens a new tab. */}
                <Link
                  to={linkTo(audit.auditId)}
                  aria-label={`Audit of ${audit.startUrl} on ${formatDate(audit.startedAt)}, score ${Math.round(audit.overallScore)}`}
                  className="row-link-target block px-3 py-2.5 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--color-accent)]"
                >
                  {formatDate(audit.startedAt)}
                </Link>
              </td>
              <td className="truncate max-w-md">{audit.startUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')}</td>
              <td className="num figure font-medium whitespace-nowrap">
                <span className="inline-flex items-center gap-2 justify-end">
                  <ScoreMeter value={audit.overallScore} score={Math.round(audit.overallScore)} />
                  <span className="w-6 text-right" style={{ color: getScoreColor(audit.overallScore) }}>{Math.round(audit.overallScore)}</span>
                </span>
              </td>
              <td className="num figure text-[var(--color-text-secondary)]">{audit.pagesAudited.toLocaleString()}</td>
              {/* A zero shows as a dash: absent is a result, and an empty cell
                  reads as missing data. */}
              <td className="num figure">{audit.failedCount > 0 ? audit.failedCount.toLocaleString() : '–'}</td>
              <td className="num figure">{audit.warningCount > 0 ? audit.warningCount.toLocaleString() : '–'}</td>
              <td className="text-[var(--color-text-muted)]">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
