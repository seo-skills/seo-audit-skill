import chalk from 'chalk';
import Table from 'cli-table3';
import type { AuditResult, CategoryResult, RuleResult } from '../types.js';
import { getCategoryById } from '../categories/index.js';

/**
 * Render a score bar visualization
 * @param score - Score from 0-100
 * @param width - Width of the bar in characters
 * @returns Colored score bar string
 */
function renderScoreBar(score: number, width = 30): string {
  const filledWidth = Math.round((score / 100) * width);
  const emptyWidth = width - filledWidth;

  const filledChar = '\u2588';
  const emptyChar = '\u2591';

  let colorFn: (text: string) => string;
  if (score >= 90) {
    colorFn = chalk.green;
  } else if (score >= 70) {
    colorFn = chalk.yellow;
  } else if (score >= 50) {
    colorFn = chalk.hex('#FFA500'); // Orange
  } else {
    colorFn = chalk.red;
  }

  const filled = colorFn(filledChar.repeat(filledWidth));
  const empty = chalk.gray(emptyChar.repeat(emptyWidth));

  return `${filled}${empty} ${colorFn(`${score}/100`)}`;
}

/**
 * Get score label based on score value
 */
function getScoreLabel(score: number): string {
  if (score >= 90) return chalk.green('Excellent');
  if (score >= 70) return chalk.yellow('Good');
  if (score >= 50) return chalk.hex('#FFA500')('Needs Work');
  return chalk.red('Poor');
}

/**
 * Render the terminal report for an audit result
 * @param result - The audit result to render
 */
export function renderTerminalReport(result: AuditResult): void {
  console.log();
  console.log(chalk.bold.cyan('='.repeat(60)));
  console.log(chalk.bold.cyan('  SEO AUDIT REPORT'));
  console.log(chalk.bold.cyan('='.repeat(60)));
  console.log();

  // URL and timestamp
  console.log(chalk.bold('URL:       ') + chalk.white(result.url));
  console.log(chalk.bold('Timestamp: ') + chalk.gray(new Date(result.timestamp).toLocaleString()));
  if (result.crawledPages > 1) {
    console.log(chalk.bold('Pages:     ') + chalk.white(`${result.crawledPages} pages crawled`));
  }
  console.log();

  // Overall Score Section
  console.log(chalk.bold.underline('OVERALL SCORE'));
  console.log();
  console.log('  ' + renderScoreBar(result.overallScore, 40));
  console.log('  ' + getScoreLabel(result.overallScore));
  console.log();

  // Category Table
  console.log(chalk.bold.underline('CATEGORY BREAKDOWN'));
  console.log();

  const table = new Table({
    head: [
      chalk.bold('Category'),
      chalk.bold('Score'),
      chalk.bold('Passed'),
      chalk.bold('Warnings'),
      chalk.bold('Failed'),
    ],
    style: {
      head: [],
      border: ['gray'],
    },
    colWidths: [22, 12, 10, 12, 10],
  });

  for (const categoryResult of result.categoryResults) {
    const category = getCategoryById(categoryResult.categoryId);
    const categoryName = category?.name ?? categoryResult.categoryId;

    let scoreColor: (text: string) => string;
    if (categoryResult.score >= 90) {
      scoreColor = chalk.green;
    } else if (categoryResult.score >= 70) {
      scoreColor = chalk.yellow;
    } else {
      scoreColor = chalk.red;
    }

    table.push([
      categoryName,
      scoreColor(`${categoryResult.score}`),
      chalk.green(`${categoryResult.passCount}`),
      categoryResult.warnCount > 0 ? chalk.yellow(`${categoryResult.warnCount}`) : chalk.gray('0'),
      categoryResult.failCount > 0 ? chalk.red(`${categoryResult.failCount}`) : chalk.gray('0'),
    ]);
  }

  console.log(table.toString());
  console.log();

  // Collect warnings and failures
  const warnings: { category: string; result: RuleResult }[] = [];
  const failures: { category: string; result: RuleResult }[] = [];

  for (const categoryResult of result.categoryResults) {
    const category = getCategoryById(categoryResult.categoryId);
    const categoryName = category?.name ?? categoryResult.categoryId;

    for (const ruleResult of categoryResult.results) {
      if (ruleResult.status === 'warn') {
        warnings.push({ category: categoryName, result: ruleResult });
      } else if (ruleResult.status === 'fail') {
        failures.push({ category: categoryName, result: ruleResult });
      }
    }
  }

  // Failures Section
  if (failures.length > 0) {
    console.log(chalk.bold.red('FAILURES') + chalk.gray(` (${failures.length} issues)`));
    console.log();

    for (const { category, result: ruleResult } of failures) {
      console.log(chalk.red('  \u2717 ') + chalk.bold(ruleResult.ruleId));
      console.log(chalk.gray(`    Category: ${category}`));
      console.log(`    ${ruleResult.message}`);

      if (ruleResult.details && Object.keys(ruleResult.details).length > 0) {
        console.log(chalk.gray('    Details:'));
        for (const [key, value] of Object.entries(ruleResult.details)) {
          const displayValue = typeof value === 'object'
            ? JSON.stringify(value)
            : String(value);
          // Truncate long values
          const truncated = displayValue.length > 60
            ? displayValue.substring(0, 57) + '...'
            : displayValue;
          console.log(chalk.gray(`      ${key}: ${truncated}`));
        }
      }
      console.log();
    }
  }

  // Warnings Section
  if (warnings.length > 0) {
    console.log(chalk.bold.yellow('WARNINGS') + chalk.gray(` (${warnings.length} issues)`));
    console.log();

    for (const { category, result: ruleResult } of warnings) {
      console.log(chalk.yellow('  \u26A0 ') + chalk.bold(ruleResult.ruleId));
      console.log(chalk.gray(`    Category: ${category}`));
      console.log(`    ${ruleResult.message}`);

      if (ruleResult.details && Object.keys(ruleResult.details).length > 0) {
        console.log(chalk.gray('    Details:'));
        for (const [key, value] of Object.entries(ruleResult.details)) {
          const displayValue = typeof value === 'object'
            ? JSON.stringify(value)
            : String(value);
          // Truncate long values
          const truncated = displayValue.length > 60
            ? displayValue.substring(0, 57) + '...'
            : displayValue;
          console.log(chalk.gray(`      ${key}: ${truncated}`));
        }
      }
      console.log();
    }
  }

  // Passed Section (summary only)
  const totalPassed = result.categoryResults.reduce((sum, cat) => sum + cat.passCount, 0);
  if (totalPassed > 0) {
    console.log(chalk.bold.green('PASSED') + chalk.gray(` (${totalPassed} checks)`));
    console.log();
  }

  // Summary
  console.log(chalk.bold.cyan('-'.repeat(60)));
  console.log();

  const totalChecks = totalPassed + warnings.length + failures.length;
  console.log(chalk.bold('Summary:'));
  console.log(`  Total checks: ${totalChecks}`);
  console.log(`  ${chalk.green('\u2713')} Passed: ${totalPassed}`);
  console.log(`  ${chalk.yellow('\u26A0')} Warnings: ${warnings.length}`);
  console.log(`  ${chalk.red('\u2717')} Failures: ${failures.length}`);
  console.log();

  // Exit code hint
  if (result.overallScore >= 70) {
    console.log(chalk.green('\u2713 Audit passed (score >= 70)'));
  } else {
    console.log(chalk.red('\u2717 Audit failed (score < 70)'));
  }
  console.log();
}
