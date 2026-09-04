import type { AuditResult, RuleResult } from '../types.js';
import { collectFindings, type Finding } from './findings.js';
import { scoreToVerdict } from '../verdict.js';
import { getCategoryById } from '../categories/index.js';

/**
 * Get emoji for score range
 */
function getScoreEmoji(score: number): string {
  if (score >= 90) return ':white_check_mark:';
  if (score >= 70) return ':yellow_circle:';
  if (score >= 50) return ':orange_circle:';
  return ':red_circle:';
}

/**
 * Get score label
 */

/**
 * Get status icon
 */
function getStatusIcon(status: string): string {
  switch (status) {
    case 'pass':
      return ':white_check_mark:';
    case 'warn':
      return ':warning:';
    case 'fail':
      return ':x:';
    default:
      return ':grey_question:';
  }
}

/**
 * Escape markdown special characters in text
 */
function escapeMarkdown(text: string | null | undefined): string {
  if (text == null) return '';
  return text.replace(/[|\\`*_{}[\]()#+\-.!]/g, '\\$&');
}

/**
 * Generate Markdown report for audit result
 * @param result - Audit result to render
 * @returns Markdown string
 */
/**
 * Where a finding was seen. A count alone ("8 pages") is not actionable, and
 * listing forty URLs is not readable, so it names a few and counts the rest.
 */
function pageAttribution(finding: Finding): string {
  if (finding.pageCount <= 1 && finding.pages.length <= 1) {
    return finding.pages.length === 1
      ? `- **Page:** ${escapeMarkdown(finding.pages[0])}`
      : '';
  }
  const shown = finding.pages.slice(0, 3).map((p) => escapeMarkdown(p));
  const rest = finding.pages.length - shown.length;
  const where = shown.length
    ? `${shown.join(', ')}${rest > 0 ? ` and ${rest} more` : ''}`
    : 'across the crawl';
  const scope = finding.measuredPages > 0
    ? `${finding.pageCount} of ${finding.measuredPages} pages`
    : `${finding.pageCount} pages`;
  return `- **Affects:** ${scope} — ${where}`;
}

export function renderMarkdownReport(result: AuditResult): string {
  const lines: string[] = [];
  const timestamp = new Date(result.timestamp).toLocaleString();

  // Header
  lines.push('# SEO Audit Report');
  lines.push('');
  lines.push(`**URL:** [${result.url}](${result.url})`);
  lines.push(`**Date:** ${timestamp}`);
  if (result.crawledPages > 1) {
    lines.push(`**Pages Audited:** ${result.crawledPages}`);
  }
  lines.push('');

  // Overall Score
  lines.push('## Overall Score');
  lines.push('');
  lines.push(`| Score | Rating |`);
  lines.push(`|-------|--------|`);
  lines.push(`| **${result.overallScore}/100** ${getScoreEmoji(result.overallScore)} | ${scoreToVerdict(result.overallScore).label} |`);
  lines.push('');
  lines.push(result.overallScore >= 70
    ? '> :white_check_mark: **Audit passed** (score >= 70)'
    : '> :x: **Audit failed** (score < 70)');
  lines.push('');

  // Category Breakdown
  lines.push('## Category Breakdown');
  lines.push('');
  // "Not measured" is its own column so a category cannot show a high score
  // beside a warning count that is really a list of checks that never ran.
  const anyNotMeasured = result.categoryResults.some((c) => (c.notMeasuredCount ?? 0) > 0);

  if (anyNotMeasured) {
    lines.push('| Category | Score | Passed | Warnings | Failed | Not measured |');
    lines.push('|----------|-------|--------|----------|--------|--------------|');
  } else {
    lines.push('| Category | Score | Passed | Warnings | Failed |');
    lines.push('|----------|-------|--------|----------|--------|');
  }

  for (const categoryResult of result.categoryResults) {
    const category = getCategoryById(categoryResult.categoryId);
    const categoryName = category?.name ?? categoryResult.categoryId;
    const emoji = getScoreEmoji(categoryResult.score);

    const row =
      `| ${escapeMarkdown(categoryName)} | ${categoryResult.score} ${emoji} ` +
      `| ${categoryResult.passCount} | ${categoryResult.warnCount} | ${categoryResult.failCount} |`;

    lines.push(anyNotMeasured ? `${row} ${categoryResult.notMeasuredCount ?? 0} |` : row);
  }
  lines.push('');

  // One entry per problem, ranked. A crawl produces one rule result per rule
  // per page, so listing them raw repeated the same finding once per page.
  const findings = collectFindings(result);
  const failures = findings.filter((f) => f.status === 'fail');
  const warnings = findings.filter((f) => f.status === 'warn');

  // Failures Section
  if (failures.length > 0) {
    lines.push('## :x: Failures');
    lines.push('');
    lines.push(`Found ${failures.length} failing ${failures.length === 1 ? 'check' : 'checks'}, most important first:`);
    lines.push('');

    for (const f of failures) {
      lines.push(`### ${escapeMarkdown(f.ruleId)}`);
      lines.push('');
      lines.push(`- **Category:** ${escapeMarkdown(f.categoryName)}`);
      lines.push(`- **Status:** ${getStatusIcon(f.status)} Failed`);
      lines.push(`- **Message:** ${escapeMarkdown(f.message)}`);
      const where = pageAttribution(f);
      if (where) lines.push(where);

      if (f.details && Object.keys(f.details).length > 0) {
        lines.push('- **Details:**');
        for (const [key, value] of Object.entries(f.details)) {
          const displayValue = typeof value === 'object'
            ? JSON.stringify(value)
            : String(value);
          const truncated = displayValue.length > 100
            ? displayValue.substring(0, 97) + '...'
            : displayValue;
          lines.push(`  - ${escapeMarkdown(key)}: \`${escapeMarkdown(truncated)}\``);
        }
      }
      lines.push('');
    }
  }

  // Warnings Section
  if (warnings.length > 0) {
    lines.push('## :warning: Warnings');
    lines.push('');
    lines.push(`Found ${warnings.length} ${warnings.length === 1 ? 'warning' : 'warnings'}, most important first:`);
    lines.push('');

    for (const f of warnings) {
      lines.push(`### ${escapeMarkdown(f.ruleId)}`);
      lines.push('');
      lines.push(`- **Category:** ${escapeMarkdown(f.categoryName)}`);
      lines.push(`- **Status:** ${getStatusIcon(f.status)} Warning`);
      lines.push(`- **Message:** ${escapeMarkdown(f.message)}`);
      const where = pageAttribution(f);
      if (where) lines.push(where);

      if (f.details && Object.keys(f.details).length > 0) {
        lines.push('- **Details:**');
        for (const [key, value] of Object.entries(f.details)) {
          const displayValue = typeof value === 'object'
            ? JSON.stringify(value)
            : String(value);
          const truncated = displayValue.length > 100
            ? displayValue.substring(0, 97) + '...'
            : displayValue;
          lines.push(`  - ${escapeMarkdown(key)}: \`${escapeMarkdown(truncated)}\``);
        }
      }
      lines.push('');
    }
  }

  // Summary
  const totalPassed = result.categoryResults.reduce((sum, cat) => sum + cat.passCount, 0);
  const totalChecks = totalPassed + warnings.length + failures.length;

  lines.push('## Summary');
  lines.push('');
  lines.push('| Metric | Count |');
  lines.push('|--------|-------|');
  lines.push(`| Total Checks | ${totalChecks} |`);
  lines.push(`| :white_check_mark: Passed | ${totalPassed} |`);
  lines.push(`| :warning: Warnings | ${warnings.length} |`);
  lines.push(`| :x: Failures | ${failures.length} |`);
  lines.push('');

  // Footer
  lines.push('---');
  lines.push('');
  lines.push('*Generated by [SEOmator CLI](https://www.npmjs.com/package/@seomator/seo-audit)*');

  return lines.join('\n');
}

/**
 * Write Markdown report to a file
 * @param result - Audit result
 * @param filePath - Output file path
 */
export async function writeMarkdownReport(result: AuditResult, filePath: string): Promise<void> {
  const fs = await import('fs');
  const markdown = renderMarkdownReport(result);
  fs.writeFileSync(filePath, markdown, 'utf-8');
}
