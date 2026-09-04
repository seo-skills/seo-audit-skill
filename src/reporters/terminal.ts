import chalk from 'chalk';
import type { AuditResult, CategoryResult, RuleResult, RuleStatus } from '../types.js';
import { getCategoryById } from '../categories/index.js';
import {
  getLetterGrade,
  formatScoreWithGrade,
  renderCompactBar,
  getScoreColor,
  renderSeparator,
} from './banner.js';
import { isNotMeasured } from '../rules/define-rule.js';
import { rulePriority } from '../rules/priority.js';
import { normalizeMessage } from './findings.js';
import { getRuleById } from '../rules/registry.js';

/**
 * Grouped issue for display
 */
interface GroupedIssue {
  ruleId: string;
  ruleName: string;
  status: RuleStatus;
  message: string;
  /** Carried through so unmeasured checks can be labelled as such, not as warnings. */
  weight?: number;
  pages: string[];
  details: Array<{ key: string; value: string }>;
  /** Set once grouping is done; see the sort in `groupIssuesByCategory`. */
  priority: number;
  /** Pages the rule could be measured on, for the priority share */
  measuredPages: number;
}

/**
 * Category with grouped issues
 */
interface CategoryIssues {
  categoryId: string;
  categoryName: string;
  errorCount: number;
  warningCount: number;
  /** Checks that took no reading; listed, but not counted as warnings. */
  notMeasuredCount: number;
  issues: GroupedIssue[];
}

/**
 * The name to show for a rule.
 *
 * Rules declare a `name` when they are defined ("Page Depth", "About Page
 * Link"); the registry is the place to ask for it. Titleizing the id instead
 * produced labels like "Links Depth" and "Eeat About Page".
 *
 * Falls back to the titleized id for results read back from storage whose rule
 * is no longer registered.
 *
 * @param ruleId - The rule identifier from the result
 * @returns The registered rule name, or a readable form of the id
 */
function displayNameFor(ruleId: string): string {
  const registered = getRuleById(ruleId);
  if (registered) {
    return registered.name;
  }
  return ruleId
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
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
 * Group issues by category, rule, and message
 */
function groupIssuesByCategory(result: AuditResult): CategoryIssues[] {
  const categoryMap = new Map<string, CategoryIssues>();
  // `${categoryId}:${ruleId}:${normalizedMessage}` -> the group, so a group is
  // found in constant time instead of by re-normalising every candidate.
  const groupsByKey = new Map<string, GroupedIssue>();

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
          notMeasuredCount: 0,
          issues: [],
        });
      }

      const categoryIssues = categoryMap.get(categoryResult.categoryId)!;

      // Update counts
      if (ruleResult.status === 'fail') {
        categoryIssues.errorCount++;
      } else if (isNotMeasured(ruleResult)) {
        categoryIssues.notMeasuredCount++;
      } else {
        categoryIssues.warningCount++;
      }

      // Find existing issue group or create new one.
      //
      // Keyed through a Map rather than a linear `find` that re-normalised
      // every candidate message on every comparison: that was O(n*m) with
      // eight regex replaces per step — invisible on an 8-page audit, roughly
      // 10^8 regex applications on a 1,000-page crawl.
      const groupKey = `${categoryResult.categoryId}:${ruleResult.ruleId}:${normalizeMessage(ruleResult.message)}`;

      let existingIssue = groupsByKey.get(groupKey);

      if (!existingIssue) {
        existingIssue = {
          ruleId: ruleResult.ruleId,
          ruleName: displayNameFor(ruleResult.ruleId),
          status: ruleResult.status,
          message: ruleResult.message,
          weight: ruleResult.weight,
          pages: [],
          details: [],
          priority: 0,
          measuredPages: 0,
        };
        categoryIssues.issues.push(existingIssue);
        groupsByKey.set(groupKey, existingIssue);
      }

      // Add page URL if available
      const pageUrl = getPageUrl(ruleResult);
      if (pageUrl && !existingIssue.pages.includes(pageUrl)) {
        existingIssue.pages.push(pageUrl);
      }

      if (!isNotMeasured(ruleResult)) existingIssue.measuredPages++;

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

  // Rank within each category. The categories are ordered by how much is wrong
  // in them; inside one, issues were left in the order their rules happened to
  // register, so a weight-1 warning could print above a weight-25 one. This is
  // the same ranking the HTML, markdown and LLM reports use, so every surface
  // answers "what first?" the same way.
  for (const category of categories) {
    for (const issue of category.issues) {
      issue.priority = rulePriority({
        ruleId: issue.ruleId,
        categoryId: category.categoryId,
        status: isNotMeasured(issue) ? 'not-measured' : issue.status,
        affectedPages: Math.max(issue.pages.length, 1),
        measuredPages: Math.max(issue.measuredPages, 1),
      });
    }
    const severity = (i: GroupedIssue): number =>
      i.status === 'fail' ? 0 : isNotMeasured(i) ? 2 : 1;
    category.issues.sort(
      (a, b) =>
        severity(a) - severity(b) ||
        b.priority - a.priority ||
        b.pages.length - a.pages.length ||
        a.ruleId.localeCompare(b.ruleId)
    );
  }

  // Sort issues within each category: errors first, then warnings
  for (const cat of categories) {
    // Failures first, then real warnings, then checks that took no reading —
    // the unmeasured ones are the least actionable, so they sink to the bottom.
    const rank = (i: GroupedIssue): number =>
      i.status === 'fail' ? 0 : isNotMeasured(i) ? 2 : 1;
    cat.issues.sort((a, b) => rank(a) - rank(b));
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
    const notMeasured = categoryResult.notMeasuredCount ?? 0;
    const skipStr = notMeasured > 0
      ? chalk.gray(` | Not measured: ${notMeasured}`)
      : '';
    console.log(`  ${passStr}${warnStr}${failStr}${skipStr}`);
  }

  console.log();

  // Calculate totals
  const totalPassed = result.categoryResults.reduce((sum, cat) => sum + cat.passCount, 0);
  const totalWarnings = result.categoryResults.reduce((sum, cat) => sum + cat.warnCount, 0);
  const totalFailures = result.categoryResults.reduce((sum, cat) => sum + cat.failCount, 0);
  const totalNotMeasured = result.categoryResults.reduce(
    (sum, cat) => sum + (cat.notMeasuredCount ?? 0),
    0
  );

  const totalSkipStr = totalNotMeasured > 0 ? `, ${totalNotMeasured} not measured` : '';
  console.log(
    chalk.gray(
      `Total: ${totalPassed} passed, ${totalWarnings} warnings, ${totalFailures} errors${totalSkipStr}`
    )
  );
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
      const notMeasuredPart = categoryIssues.notMeasuredCount > 0
        ? chalk.gray(`${categoryIssues.notMeasuredCount} not measured`)
        : '';
      const header = [errorPart, warningPart, notMeasuredPart].filter(Boolean).join(', ');

      console.log(chalk.bold(`${categoryIssues.categoryName}`) + chalk.gray(` (${header})`));

      for (const issue of categoryIssues.issues) {
        // Issue type indicator
        const typeLabel = issue.status === 'fail'
          ? chalk.red('(error)')
          : isNotMeasured(issue)
            ? chalk.gray('(not measured)')
            : chalk.yellow('(warning)');

        // Rule ID and name
        console.log(`  ${chalk.gray(issue.ruleId)} ${issue.ruleName} ${typeLabel}`);

        // Status icon and message. Three states, not two: a check that took no
        // reading was drawn with the same yellow warning triangle as a real
        // warning, one line under a label reading "(not measured)".
        const icon = issue.status === 'fail'
          ? chalk.red('✗')
          : isNotMeasured(issue)
            ? chalk.gray('–')
            : chalk.yellow('⚠');
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

  // Summary footer. Carries the not-measured count too: without it the closing
  // line read "217 passed • 34 warnings • 24 failed" for a 332-rule audit, and
  // the 57 checks that never ran simply vanished from the last thing the user
  // sees. The HTML report has always shown all four numbers.
  console.log(renderSeparator(50));
  console.log(
    `${chalk.green(`${totalPassed} passed`)} ${chalk.gray('•')} ` +
    `${chalk.yellow(`${totalWarnings} warnings`)} ${chalk.gray('•')} ` +
    `${chalk.red(`${totalFailures} failed`)}` +
    (totalNotMeasured > 0
      ? ` ${chalk.gray('•')} ${chalk.gray(`${totalNotMeasured} not measured`)}`
      : '')
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
