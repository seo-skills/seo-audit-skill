/**
 * Every failing and warning rule, worst first.
 *
 * A real audit produces well over a hundred of these, and rendering them all
 * turned this table into a nine-thousand-pixel wall that buried the score and
 * the category grid above it. It shows the worst ones and opens the rest on
 * request, which is how many of them anyone reads in one sitting anyway.
 */

import { useState } from 'react';
import type { AuditResult } from '../../src/types.js';
import type { RuleMetadata } from '../../electron/shared/ipc-types.js';
import { formatRuleIdAsName, getStatusColorClass, getStatusIcon, safeHref } from '../lib/format.js';

const CATEGORY_NAMES: Record<string, string> = {
  core: 'Core SEO', technical: 'Technical SEO', perf: 'Performance',
  links: 'Links', images: 'Images', security: 'Security',
  crawl: 'Crawlability', schema: 'Structured Data', a11y: 'Accessibility',
  content: 'Content', social: 'Social', eeat: 'E-E-A-T',
  url: 'URL Structure', mobile: 'Mobile', i18n: 'Internationalization',
  legal: 'Legal', js: 'JS Rendering', redirect: 'Redirects',
  htmlval: 'HTML Validation', geo: 'AI/GEO',
};

interface IssuesTableProps {
  result: AuditResult;
  ruleMetadata?: Record<string, RuleMetadata>;
  onIssueClick?: (ruleId: string, categoryId: string) => void;
}

/** How many issues are shown before the rest are collapsed */
const VISIBLE_ISSUES = 12;

interface IssueRow {
  ruleId: string;
  ruleName: string;
  categoryId: string;
  categoryName: string;
  status: 'fail' | 'warn';
  message: string;
  pageUrl: string | null;
  count: number;
}

export function IssuesTable({ result, ruleMetadata, onIssueClick }: IssuesTableProps) {
  const [showAll, setShowAll] = useState(false);

  // Aggregate issues across categories
  const issues: IssueRow[] = [];
  for (const cat of result.categoryResults) {
    const ruleMap = new Map<string, IssueRow>();
    for (const rule of cat.results) {
      if (rule.status === 'pass') continue;
      const existing = ruleMap.get(rule.ruleId);
      if (existing) {
        existing.count++;
      } else {
        const pageUrl = rule.details?.pageUrl as string | undefined;
        ruleMap.set(rule.ruleId, {
          ruleId: rule.ruleId,
          ruleName: ruleMetadata?.[rule.ruleId]?.name ?? formatRuleIdAsName(rule.ruleId),
          categoryId: cat.categoryId,
          categoryName: CATEGORY_NAMES[cat.categoryId] ?? cat.categoryId,
          status: rule.status as 'fail' | 'warn',
          message: rule.message,
          pageUrl: pageUrl ?? null,
          count: 1,
        });
      }
    }
    issues.push(...ruleMap.values());
  }

  // Sort: failures first, then by count descending
  issues.sort((a, b) => {
    if (a.status !== b.status) return a.status === 'fail' ? -1 : 1;
    return b.count - a.count;
  });

  if (issues.length === 0) {
    return (
      <div className="text-center py-8" style={{ color: 'var(--color-text-muted)' }}>
        No issues found
      </div>
    );
  }

  const shown = showAll ? issues : issues.slice(0, VISIBLE_ISSUES);
  const hidden = issues.length - shown.length;

  return (
    // The table keeps its column widths, so on a narrow screen it scrolls
    // inside this box rather than widening the page.
    <div className="rounded-lg border border-[var(--color-border)] overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-[var(--color-bg-hover)]">
            <th className="text-left p-3 font-medium text-xs uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>Issue</th>
            <th className="text-left p-3 font-medium text-xs uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>Page</th>
            <th className="text-center p-3 font-medium text-xs uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>Severity</th>
            {result.crawledPages > 1 && (
              <th className="text-center p-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Pages</th>
            )}
          </tr>
        </thead>
        <tbody>
          {shown.map((issue) => (
            <tr
              key={`${issue.categoryId}-${issue.ruleId}`}
              onClick={() => onIssueClick?.(issue.ruleId, issue.categoryId)}
              className="border-t border-[var(--color-border-subtle)] hover:bg-[var(--color-bg-hover)] cursor-pointer transition-colors"
            >
              <td className="p-3">
                <div className="flex items-center gap-2">
                  <span className={`font-bold ${getStatusColorClass(issue.status)}`}>
                    {getStatusIcon(issue.status)}
                  </span>
                  <div>
                    <div className="font-medium" style={{ color: 'var(--color-text)' }}>{issue.ruleName}</div>
                    <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{issue.categoryName}</div>
                  </div>
                </div>
              </td>
              <td className="p-3" style={{ color: 'var(--color-text-secondary)' }}>
                {issue.pageUrl ? (
                  <a
                    href={safeHref(issue.pageUrl)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-mono hover:underline"
                    style={{ color: 'var(--color-accent)' }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {(() => { try { return new URL(issue.pageUrl).pathname; } catch { return issue.pageUrl; } })()}
                  </a>
                ) : (
                  <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>—</span>
                )}
              </td>
              <td className="p-3 text-center">
                <span
                  className="text-xs px-2 py-0.5 rounded font-medium"
                  style={{
                    color: issue.status === 'fail' ? 'var(--color-fail)' : 'var(--color-warn)',
                    backgroundColor: issue.status === 'fail' ? 'var(--color-fail-bg)' : 'var(--color-warn-bg)',
                  }}
                >
                  {issue.status === 'fail' ? 'Critical' : 'Warning'}
                </span>
              </td>
              {result.crawledPages > 1 && (
                <td className="p-3 text-center" style={{ color: 'var(--color-text-muted)' }}>
                  {issue.count}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="w-full p-3 text-sm border-t border-[var(--color-border-subtle)] hover:bg-[var(--color-bg-hover)] transition-colors"
          style={{ color: 'var(--color-accent)' }}
        >
          Show {hidden} more {hidden === 1 ? 'issue' : 'issues'}
        </button>
      )}
      {showAll && issues.length > VISIBLE_ISSUES && (
        <button
          type="button"
          onClick={() => setShowAll(false)}
          className="w-full p-3 text-sm border-t border-[var(--color-border-subtle)] hover:bg-[var(--color-bg-hover)] transition-colors"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          Show fewer
        </button>
      )}
    </div>
  );
}
