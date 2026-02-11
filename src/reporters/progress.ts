import ora, { type Ora } from 'ora';
import cliProgress from 'cli-progress';
import chalk from 'chalk';
import type { CategoryResult, RuleResult } from '../types.js';
import { getCategoryById } from '../categories/index.js';

/**
 * Progress reporter using ora spinners and cli-progress bars
 * Provides real-time feedback during audit execution
 */
export class ProgressReporter {
  private spinner: Ora | null = null;
  private progressBar: cliProgress.SingleBar | null = null;
  private categoryResults: Map<string, CategoryResult> = new Map();
  private isJsonMode: boolean;
  private isCrawlMode: boolean;
  private isVerbose: boolean;

  constructor(options: { json?: boolean; crawl?: boolean; verbose?: boolean } = {}) {
    this.isJsonMode = options.json ?? false;
    this.isCrawlMode = options.crawl ?? false;
    this.isVerbose = options.verbose ?? false;
  }

  /**
   * Check if we should show progress (either not JSON mode, or verbose mode)
   */
  private shouldShowProgress(): boolean {
    return !this.isJsonMode || this.isVerbose;
  }

  /**
   * Log to stderr (for verbose mode in JSON output)
   */
  private log(message: string): void {
    if (this.isJsonMode && this.isVerbose) {
      process.stderr.write(message + '\n');
    } else if (!this.isJsonMode) {
      console.log(message);
    }
  }

  /**
   * Start the audit progress display
   * Note: Banner is now rendered separately before this is called
   */
  start(url: string): void {
    if (!this.shouldShowProgress()) {
      return;
    }
    // Banner already shows URL, just add spacing
    this.log('');
  }

  /**
   * Called when a category audit starts
   */
  onCategoryStart(categoryId: string, categoryName: string): void {
    if (!this.shouldShowProgress()) {
      return;
    }

    // In verbose JSON mode, just log to stderr (no spinner)
    if (this.isJsonMode && this.isVerbose) {
      this.log(chalk.yellow(`Auditing ${categoryName}...`));
      return;
    }

    this.spinner = ora({
      text: chalk.yellow(`Auditing ${categoryName}...`),
      spinner: 'dots',
    }).start();
  }

  /**
   * Called when a rule completes
   */
  onRuleComplete(ruleId: string, ruleName: string, result: RuleResult): void {
    if (!this.shouldShowProgress()) {
      return;
    }

    const statusIcon = this.getStatusIcon(result.status);

    // In verbose JSON mode, log each rule to stderr
    if (this.isJsonMode && this.isVerbose) {
      this.log(`  ${statusIcon} ${ruleName}`);
      return;
    }

    if (this.spinner) {
      this.spinner.text = chalk.yellow(`Auditing... ${statusIcon} ${ruleName}`);
    }
  }

  /**
   * Called when a category audit completes
   */
  onCategoryComplete(
    categoryId: string,
    categoryName: string,
    result: CategoryResult
  ): void {
    if (!this.shouldShowProgress()) {
      return;
    }

    this.categoryResults.set(categoryId, result);

    if (this.spinner) {
      this.spinner.stop();
      this.spinner = null;
    }

    // Print category result line
    this.printCategoryResult(categoryId, categoryName, result);
  }

  /**
   * Print a single category result with pass/fail indicators
   */
  private printCategoryResult(
    categoryId: string,
    categoryName: string,
    result: CategoryResult
  ): void {
    const scoreColor = this.getScoreColor(result.score);
    const scoreStr = `${result.score}`.padStart(3);

    const passStr = chalk.green(`${result.passCount} passed`);
    const warnStr = result.warnCount > 0 ? chalk.yellow(`, ${result.warnCount} warnings`) : '';
    const failStr = result.failCount > 0 ? chalk.red(`, ${result.failCount} failed`) : '';

    this.log(
      `  ${this.getCategoryIcon(result)} ${categoryName.padEnd(20)} ` +
      `${scoreColor(scoreStr)} ${passStr}${warnStr}${failStr}`
    );
  }

  /**
   * Get icon for category based on result
   */
  private getCategoryIcon(result: CategoryResult): string {
    if (result.failCount > 0) {
      return chalk.red('\u2717'); // Cross mark
    }
    if (result.warnCount > 0) {
      return chalk.yellow('\u26A0'); // Warning
    }
    return chalk.green('\u2713'); // Check mark
  }

  /**
   * Get status icon for a rule result
   */
  private getStatusIcon(status: 'pass' | 'warn' | 'fail'): string {
    switch (status) {
      case 'pass':
        return chalk.green('\u2713');
      case 'warn':
        return chalk.yellow('\u26A0');
      case 'fail':
        return chalk.red('\u2717');
    }
  }

  /**
   * Get chalk color function based on score
   */
  private getScoreColor(score: number): (text: string) => string {
    if (score >= 90) return chalk.green;
    if (score >= 70) return chalk.yellow;
    return chalk.red;
  }

  /**
   * Start crawl progress bar
   */
  startCrawlProgress(totalPages: number): void {
    if (!this.shouldShowProgress()) {
      return;
    }

    this.log('');
    this.log(chalk.bold(`Crawling and auditing up to ${totalPages} pages...`));
    this.log(chalk.gray('(Each page runs 251 SEO checks across 20 categories)'));
    this.log('');

    // In verbose JSON mode, don't use progress bar (use simple logs)
    if (this.isJsonMode && this.isVerbose) {
      return;
    }

    this.progressBar = new cliProgress.SingleBar(
      {
        format: chalk.cyan('{bar}') + ' {percentage}% | {value}/{total} pages | {url}',
        barCompleteChar: '\u2588',
        barIncompleteChar: '\u2591',
        hideCursor: true,
      },
      cliProgress.Presets.shades_classic
    );

    this.progressBar.start(totalPages, 0, { url: 'Starting...' });
  }

  /**
   * Update crawl progress
   */
  onPageComplete(url: string, pageNumber: number, totalPages: number): void {
    if (!this.shouldShowProgress()) {
      return;
    }

    // Truncate URL if too long
    const maxUrlLength = 50;
    const displayUrl = url.length > maxUrlLength
      ? url.substring(0, maxUrlLength - 3) + '...'
      : url;

    // In verbose JSON mode, log to stderr
    if (this.isJsonMode && this.isVerbose) {
      this.log(chalk.gray(`  [${pageNumber}/${totalPages}] ${displayUrl}`));
      return;
    }

    if (this.progressBar) {
      this.progressBar.update(pageNumber, { url: displayUrl });

      if (pageNumber >= totalPages) {
        this.progressBar.stop();
        this.progressBar = null;
        console.log();
      }
    }
  }

  /**
   * Render the category tree with results
   */
  renderCategoryTree(): void {
    if (!this.shouldShowProgress() || this.categoryResults.size === 0) {
      return;
    }

    this.log('');
    this.log(chalk.bold('Category Results:'));
    this.log('');

    for (const [categoryId, result] of this.categoryResults) {
      const category = getCategoryById(categoryId);
      if (!category) continue;

      const icon = this.getCategoryIcon(result);
      const scoreColor = this.getScoreColor(result.score);

      this.log(`${icon} ${chalk.bold(category.name)} - ${scoreColor(`${result.score}/100`)}`);

      // Show individual rule results
      for (const ruleResult of result.results) {
        const ruleIcon = this.getStatusIcon(ruleResult.status);
        const indent = '    ';
        this.log(`${indent}${ruleIcon} ${ruleResult.message}`);
      }

      this.log('');
    }
  }

  /**
   * Stop any active progress indicators
   */
  stop(): void {
    if (this.spinner) {
      this.spinner.stop();
      this.spinner = null;
    }
    if (this.progressBar) {
      this.progressBar.stop();
      this.progressBar = null;
    }
  }
}
