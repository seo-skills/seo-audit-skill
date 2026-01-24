/**
 * LLM-optimized report format
 *
 * Produces token-efficient XML output designed for AI agent consumption.
 * Features:
 * - 40-70% smaller than JSON output
 * - Issues sorted by severity (critical first)
 * - Actionable fix suggestions included
 * - Compact inline attributes
 * - Clean stdout for piping to Claude/LLMs
 */

import type { AuditResult } from '../types.js';
import { getFixSuggestion } from './fix-suggestions.js';

/**
 * Get letter grade from score
 */
function getGrade(score: number): string {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

/**
 * Map rule status to severity
 */
function getSeverity(status: string): string {
  return status === 'fail' ? 'critical' : 'warning';
}

/**
 * Escape special XML characters
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Truncate string to max length
 */
function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Format details object as compact string
 */
function formatDetails(details: Record<string, unknown>): string {
  const entries = Object.entries(details)
    .map(([k, v]) => {
      const value = typeof v === 'object' ? JSON.stringify(v) : String(v);
      return `${k}=${truncate(value, 50)}`;
    })
    .join(', ');
  return truncate(entries, 200);
}

interface IssueData {
  severity: string;
  rule: string;
  cat: string;
  msg: string;
  details?: Record<string, unknown>;
}

/**
 * Render audit result in LLM-optimized XML format
 *
 * @param result - The audit result to render
 * @param prettyPrint - Whether to add indentation and newlines (default: false for minimal tokens)
 * @returns XML string
 */
export function renderLlmReport(result: AuditResult, prettyPrint = false): string {
  const nl = prettyPrint ? '\n' : '';
  const t1 = prettyPrint ? '  ' : '';
  const t2 = prettyPrint ? '    ' : '';
  const t3 = prettyPrint ? '      ' : '';

  const lines: string[] = [];
  const date = new Date(result.timestamp).toISOString().split('T')[0];

  // Root element with summary attributes
  lines.push(
    `<seo-audit url="${escapeXml(result.url)}" score="${result.overallScore}" grade="${getGrade(result.overallScore)}" pages="${result.crawledPages}" date="${date}">${nl}`
  );

  // Summary counts
  const totalPassed = result.categoryResults.reduce((sum, cat) => sum + cat.passCount, 0);
  const totalWarnings = result.categoryResults.reduce((sum, cat) => sum + cat.warnCount, 0);
  const totalFailures = result.categoryResults.reduce((sum, cat) => sum + cat.failCount, 0);
  lines.push(`${t1}<summary passed="${totalPassed}" warnings="${totalWarnings}" failures="${totalFailures}"/>${nl}`);

  // Categories (compact format)
  lines.push(`${t1}<categories>${nl}`);
  for (const cat of result.categoryResults) {
    lines.push(
      `${t2}<cat id="${cat.categoryId}" score="${cat.score}" p="${cat.passCount}" w="${cat.warnCount}" f="${cat.failCount}"/>${nl}`
    );
  }
  lines.push(`${t1}</categories>${nl}`);

  // Collect issues and passed rules
  const issues: IssueData[] = [];
  const passed: string[] = [];

  for (const cat of result.categoryResults) {
    for (const r of cat.results) {
      if (r.status === 'fail' || r.status === 'warn') {
        issues.push({
          severity: getSeverity(r.status),
          rule: r.ruleId,
          cat: cat.categoryId,
          msg: r.message,
          details: r.details,
        });
      } else {
        passed.push(r.ruleId);
      }
    }
  }

  // Sort issues: critical first, then warning
  issues.sort((a, b) => {
    if (a.severity === 'critical' && b.severity !== 'critical') return -1;
    if (a.severity !== 'critical' && b.severity === 'critical') return 1;
    return 0;
  });

  // Issues section
  if (issues.length > 0) {
    lines.push(`${t1}<issues>${nl}`);
    for (const issue of issues) {
      lines.push(`${t2}<issue severity="${issue.severity}" rule="${issue.rule}" cat="${issue.cat}">${nl}`);
      lines.push(`${t3}<msg>${escapeXml(issue.msg)}</msg>${nl}`);

      const fix = getFixSuggestion(issue.rule);
      lines.push(`${t3}<fix>${escapeXml(fix)}</fix>${nl}`);

      if (issue.details && Object.keys(issue.details).length > 0) {
        const detailStr = formatDetails(issue.details);
        lines.push(`${t3}<details>${escapeXml(detailStr)}</details>${nl}`);
      }
      lines.push(`${t2}</issue>${nl}`);
    }
    lines.push(`${t1}</issues>${nl}`);
  }

  // Passed rules (collapsed into comma-separated list)
  if (passed.length > 0) {
    lines.push(`${t1}<passed>${passed.join(', ')}</passed>${nl}`);
  }

  lines.push(`</seo-audit>`);

  return lines.join('');
}

/**
 * Output LLM report to console
 * Uses console.log for clean stdout (no stderr messages)
 */
export function outputLlmReport(result: AuditResult): void {
  console.log(renderLlmReport(result));
}
