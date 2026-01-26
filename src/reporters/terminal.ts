import chalk from 'chalk';
import type { AuditResult, CategoryResult, RuleResult } from '../types.js';
import { getCategoryById } from '../categories/index.js';
import {
  getLetterGrade,
  formatScoreWithGrade,
  renderCompactBar,
  getScoreColor,
  renderSeparator,
} from './banner.js';

/**
 * Grouped issue for display
 */
interface GroupedIssue {
  ruleId: string;
  ruleName: string;
  status: 'warn' | 'fail';
  message: string;
  pages: string[];
  details: Array<{ key: string; value: string }>;
}

/**
 * Category with grouped issues
 */
interface CategoryIssues {
  categoryId: string;
  categoryName: string;
  errorCount: number;
  warningCount: number;
  issues: GroupedIssue[];
}

/**
 * Extract page URL from rule result details
 */
function getPageUrl(result: RuleResult): string | null {
  if (result.details?.pageUrl) {
    return String(result.details.pageUrl);
  }
  if (result.details?.url) {
    return String(result.details.url);
  }
  return null;
}

/**
 * Normalize a message for grouping (strip variable parts)
 */
function normalizeMessage(message: string): string {
  // Remove specific numbers that vary (like "20 chars" -> "X chars")
  return message
    .replace(/\d+ chars?/g, 'X chars')
    .replace(/\d+ words?/g, 'X words')
    .replace(/\d+ images?/g, 'X images')
    .replace(/\d+ links?/g, 'X links')
    .replace(/\d+px/g, 'Xpx')
    .replace(/\d+ms/g, 'Xms')
    .replace(/\d+KB/g, 'XKB')
    .replace(/\d+\.\d+s/g, 'X.Xs');
}

/**
 * Group issues by category, rule, and message
 */
function groupIssuesByCategory(result: AuditResult): CategoryIssues[] {
  const categoryMap = new Map<string, CategoryIssues>();

  for (const categoryResult of result.categoryResults) {
    const category = getCategoryById(categoryResult.categoryId);
    const categoryName = category?.name ?? categoryResult.categoryId;

    for (const ruleResult of categoryResult.results) {
      if (ruleResult.status === 'pass') continue;

      // Get or create category entry
      if (!categoryMap.has(categoryResult.categoryId)) {
        categoryMap.set(categoryResult.categoryId, {
          categoryId: categoryResult.categoryId,
          categoryName,
          errorCount: 0,
          warningCount: 0,
          issues: [],
        });
      }

      const categoryIssues = categoryMap.get(categoryResult.categoryId)!;

      // Update counts
      if (ruleResult.status === 'fail') {
        categoryIssues.errorCount++;
      } else {
        categoryIssues.warningCount++;
      }

      // Find existing issue group or create new one
      const normalizedMsg = normalizeMessage(ruleResult.message);
      const groupKey = `${ruleResult.ruleId}:${normalizedMsg}`;

      let existingIssue = categoryIssues.issues.find(
        (i) => `${i.ruleId}:${normalizeMessage(i.message)}` === groupKey
      );

      if (!existingIssue) {
        existingIssue = {
          ruleId: ruleResult.ruleId,
          ruleName: ruleResult.ruleId.split('-').map(w =>
            w.charAt(0).toUpperCase() + w.slice(1)
          ).join(' '),
          status: ruleResult.status,
          message: ruleResult.message,
          pages: [],
          details: [],
        };
        categoryIssues.issues.push(existingIssue);
      }

      // Add page URL if available
      const pageUrl = getPageUrl(ruleResult);
      if (pageUrl && !existingIssue.pages.includes(pageUrl)) {
        existingIssue.pages.push(pageUrl);
      }

      // Collect non-URL details
      if (ruleResult.details) {
        for (const [key, value] of Object.entries(ruleResult.details)) {
          if (key === 'pageUrl' || key === 'url') continue;
          const strValue = typeof value === 'object'
            ? JSON.stringify(value)
            : String(value);
          // Only add if not already present
          if (!existingIssue.details.some(d => d.key === key && d.value === strValue)) {
            existingIssue.details.push({ key, value: strValue });
          }
        }
      }
    }
  }

  // Sort categories by error count (most errors first)
  const categories = Array.from(categoryMap.values());
  categories.sort((a, b) => {
    // Sort by errors first, then warnings
    if (b.errorCount !== a.errorCount) return b.errorCount - a.errorCount;
    return b.warningCount - a.warningCount;
  });

  // Sort issues within each category: errors first, then warnings
  for (const cat of categories) {
    cat.issues.sort((a, b) => {
      if (a.status === 'fail' && b.status === 'warn') return -1;
      if (a.status === 'warn' && b.status === 'fail') return 1;
      return 0;
    });
  }

  return categories;
}

/**
 * Render pages list with "+N more" truncation
 */
function renderPagesList(pages: string[], maxItems = 5, indent = '      '): void {
  const displayPages = pages.slice(0, maxItems);

  for (const page of displayPages) {
    // Simplify URL for display
    let displayUrl = page;
    try {
      const url = new URL(page);
      displayUrl = url.pathname || '/';
    } catch {
      // Keep original if not a valid URL
    }
    console.log(chalk.gray(`${indent}→ ${displayUrl}`));
  }

  if (pages.length > maxItems) {
    console.log(chalk.gray(`${indent}... +${pages.length - maxItems} more`));
  }
}

/**
 * Render details list with truncation
 */
function renderDetailsList(details: Array<{ key: string; value: string }>, maxItems = 5, indent = '      '): void {
  const displayDetails = details.slice(0, maxItems);

  for (const { key, value } of displayDetails) {
    // Truncate long values
    const truncated = value.length > 60 ? value.substring(0, 57) + '...' : value;
    console.log(chalk.gray(`${indent}→ ${truncated}`));
  }

  if (details.length > maxItems) {
    console.log(chalk.gray(`${indent}... +${details.length - maxItems} more`));
  }
}

/**
 * Render the terminal report for an audit result
 * @param result - The audit result to render
 */
export function renderTerminalReport(result: AuditResult): void {
  console.log();

  // Report header
  console.log(renderSeparator(50));
  console.log(chalk.bold('SEOMATOR REPORT'));

  // URL, pages, and score in one line
  const domain = extractDomain(result.url);
  const pageInfo = result.crawledPages > 1 ? `${result.crawledPages} pages` : '1 page';
  console.log(
    `${chalk.white(domain)} ${chalk.gray('•')} ${chalk.gray(pageInfo)} ${chalk.gray('•')} ${formatScoreWithGrade(result.overallScore)}`
  );
  console.log(renderSeparator(50));
  console.log();

  // Health Score
  const { grade, color } = getLetterGrade(result.overallScore);
  console.log(`${chalk.bold('Health Score:')} ${color(`${result.overallScore}/100 (${grade})`)}`);
  console.log();

  // Category Breakdown
  console.log(chalk.bold('Category Breakdown:'));
  console.log(chalk.gray('-'.repeat(50)));

  // Sort categories by score (worst first for priority)
  const sortedCategories = [...result.categoryResults].sort((a, b) => a.score - b.score);

  for (const categoryResult of sortedCategories) {
    const category = getCategoryById(categoryResult.categoryId);
    const categoryName = category?.name ?? categoryResult.categoryId;
    const scoreColor = getScoreColor(categoryResult.score);
    const bar = renderCompactBar(categoryResult.score);

    // Category name and progress bar
    console.log(
      `${categoryName.padEnd(20)} ${scoreColor(bar)} ${scoreColor(`${categoryResult.score}%`)}`
    );

    // Pass/warn/fail counts on second line
    const passStr = chalk.green(`Passed: ${categoryResult.passCount}`);
    const warnStr = categoryResult.warnCount > 0
      ? chalk.yellow(` | Warnings: ${categoryResult.warnCount}`)
      : '';
    const failStr = categoryResult.failCount > 0
      ? chalk.red(` | Failed: ${categoryResult.failCount}`)
      : '';
    console.log(`  ${passStr}${warnStr}${failStr}`);
  }

  console.log();

  // Calculate totals
  const totalPassed = result.categoryResults.reduce((sum, cat) => sum + cat.passCount, 0);
  const totalWarnings = result.categoryResults.reduce((sum, cat) => sum + cat.warnCount, 0);
  const totalFailures = result.categoryResults.reduce((sum, cat) => sum + cat.failCount, 0);

  console.log(chalk.gray(`Total: ${totalPassed} passed, ${totalWarnings} warnings, ${totalFailures} errors`));
  console.log();

  // Grouped Issues
  const groupedIssues = groupIssuesByCategory(result);

  if (groupedIssues.length > 0) {
    console.log(chalk.bold('ISSUES'));
    console.log();

    for (const categoryIssues of groupedIssues) {
      // Category header with counts
      const errorPart = categoryIssues.errorCount > 0
        ? chalk.red(`${categoryIssues.errorCount} errors`)
        : '';
      const warningPart = categoryIssues.warningCount > 0
        ? chalk.yellow(`${categoryIssues.warningCount} warnings`)
        : '';
      const separator = errorPart && warningPart ? ', ' : '';

      console.log(chalk.bold(`${categoryIssues.categoryName}`) + chalk.gray(` (${errorPart}${separator}${warningPart})`));

      for (const issue of categoryIssues.issues) {
        // Issue type indicator
        const typeLabel = issue.status === 'fail'
          ? chalk.red('(error)')
          : chalk.yellow('(warning)');

        // Rule ID and name
        console.log(`  ${chalk.gray(issue.ruleId)} ${issue.ruleName} ${typeLabel}`);

        // Status icon and message
        const icon = issue.status === 'fail' ? chalk.red('✗') : chalk.yellow('⚠');
        const pageCount = issue.pages.length > 1 ? ` (${issue.pages.length} pages)` : '';
        console.log(`    ${icon} ${issue.ruleId}: ${issue.message}${chalk.gray(pageCount)}`);

        // Show affected pages
        if (issue.pages.length > 0) {
          renderPagesList(issue.pages, 5, '      ');
        }

        // Show other details
        if (issue.details.length > 0 && issue.pages.length === 0) {
          renderDetailsList(issue.details, 5, '      ');
        }
      }
      console.log();
    }
  }

  // Summary footer
  console.log(renderSeparator(50));
  console.log(
    `${chalk.green(`${totalPassed} passed`)} ${chalk.gray('•')} ` +
    `${chalk.yellow(`${totalWarnings} warnings`)} ${chalk.gray('•')} ` +
    `${chalk.red(`${totalFailures} failed`)}`
  );
  console.log(renderSeparator(50));
  console.log();
}

/**
 * Extract domain from URL
 */
function extractDomain(url: string): string {
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    return parsed.hostname;
  } catch {
    return url;
  }
}
