import type { AuditResult, RuleResult } from '../types.js';
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
function getScoreLabel(score: number): string {
  if (score >= 90) return 'Excellent';
  if (score >= 70) return 'Good';
  if (score >= 50) return 'Needs Work';
  return 'Poor';
}

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
  lines.push(`| **${result.overallScore}/100** ${getScoreEmoji(result.overallScore)} | ${getScoreLabel(result.overallScore)} |`);
  lines.push('');
  lines.push(result.overallScore >= 70
    ? '> :white_check_mark: **Audit passed** (score >= 70)'
    : '> :x: **Audit failed** (score < 70)');
  lines.push('');

  // Category Breakdown
  lines.push('## Category Breakdown');
  lines.push('');
  lines.push('| Category | Score | Passed | Warnings | Failed |');
  lines.push('|----------|-------|--------|----------|--------|');

  for (const categoryResult of result.categoryResults) {
    const category = getCategoryById(categoryResult.categoryId);
    const categoryName = category?.name ?? categoryResult.categoryId;
    const emoji = getScoreEmoji(categoryResult.score);

    lines.push(
      `| ${escapeMarkdown(categoryName)} | ${categoryResult.score} ${emoji} | ${categoryResult.passCount} | ${categoryResult.warnCount} | ${categoryResult.failCount} |`
    );
  }
  lines.push('');

  // Collect issues
  const failures: { category: string; result: RuleResult }[] = [];
  const warnings: { category: string; result: RuleResult }[] = [];

  for (const categoryResult of result.categoryResults) {
    const category = getCategoryById(categoryResult.categoryId);
    const categoryName = category?.name ?? categoryResult.categoryId;

    for (const ruleResult of categoryResult.results) {
      if (ruleResult.status === 'fail') {
        failures.push({ category: categoryName, result: ruleResult });
      } else if (ruleResult.status === 'warn') {
        warnings.push({ category: categoryName, result: ruleResult });
      }
    }
  }

  // Failures Section
  if (failures.length > 0) {
    lines.push('## :x: Failures');
    lines.push('');
    lines.push(`Found ${failures.length} failing checks:`);
    lines.push('');

    for (const { category, result: r } of failures) {
      lines.push(`### ${escapeMarkdown(r.ruleId)}`);
      lines.push('');
      lines.push(`- **Category:** ${escapeMarkdown(category)}`);
      lines.push(`- **Status:** ${getStatusIcon(r.status)} Failed`);
      lines.push(`- **Message:** ${escapeMarkdown(r.message)}`);

      if (r.details && Object.keys(r.details).length > 0) {
        lines.push('- **Details:**');
        for (const [key, value] of Object.entries(r.details)) {
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
    lines.push(`Found ${warnings.length} warnings:`);
    lines.push('');

    for (const { category, result: r } of warnings) {
      lines.push(`### ${escapeMarkdown(r.ruleId)}`);
      lines.push('');
      lines.push(`- **Category:** ${escapeMarkdown(category)}`);
      lines.push(`- **Status:** ${getStatusIcon(r.status)} Warning`);
      lines.push(`- **Message:** ${escapeMarkdown(r.message)}`);

      if (r.details && Object.keys(r.details).length > 0) {
        lines.push('- **Details:**');
        for (const [key, value] of Object.entries(r.details)) {
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
