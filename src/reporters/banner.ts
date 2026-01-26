import chalk from 'chalk';

/**
 * ASCII art banner for SEOmator CLI
 */
const ASCII_BANNER = `
 ███████╗███████╗ ██████╗ ███╗   ███╗ █████╗ ████████╗ ██████╗ ██████╗
 ██╔════╝██╔════╝██╔═══██╗████╗ ████║██╔══██╗╚══██╔══╝██╔═══██╗██╔══██╗
 ███████╗█████╗  ██║   ██║██╔████╔██║███████║   ██║   ██║   ██║██████╔╝
 ╚════██║██╔══╝  ██║   ██║██║╚██╔╝██║██╔══██║   ██║   ██║   ██║██╔══██╗
 ███████║███████╗╚██████╔╝██║ ╚═╝ ██║██║  ██║   ██║   ╚██████╔╝██║  ██║
 ╚══════╝╚══════╝ ╚═════╝ ╚═╝     ╚═╝╚═╝  ╚═╝   ╚═╝    ╚═════╝ ╚═╝  ╚═╝
`;

/**
 * CLI version (should match package.json)
 */
const VERSION = '2.1.0';

/**
 * Website URL
 */
const WEBSITE_URL = 'https://seomator.com';

export interface BannerOptions {
  url: string;
  configPath?: string;
  maxPages?: number;
  crawlMode?: boolean;
}

/**
 * Letter grade result with color function
 */
export interface LetterGradeResult {
  grade: string;
  color: (text: string) => string;
}

/**
 * Get letter grade for a score
 * @param score - Score from 0-100
 * @returns Letter grade and color function
 */
export function getLetterGrade(score: number): LetterGradeResult {
  if (score >= 90) {
    return { grade: 'A', color: chalk.green };
  }
  if (score >= 80) {
    return { grade: 'B', color: chalk.green };
  }
  if (score >= 70) {
    return { grade: 'C', color: chalk.yellow };
  }
  if (score >= 50) {
    return { grade: 'D', color: chalk.hex('#FFA500') }; // Orange
  }
  return { grade: 'F', color: chalk.red };
}

/**
 * Format score with letter grade
 * @param score - Score from 0-100
 * @returns Formatted string like "43/100 (F)"
 */
export function formatScoreWithGrade(score: number): string {
  const { grade, color } = getLetterGrade(score);
  return color(`${score}/100 (${grade})`);
}

/**
 * Extract domain from URL for display
 */
function extractDomain(url: string): string {
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    return parsed.hostname;
  } catch {
    return url;
  }
}

/**
 * Render the ASCII banner with audit info
 * @param options - Banner options
 */
export function renderBanner(options: BannerOptions): void {
  // ASCII art in cyan
  console.log(chalk.cyan(ASCII_BANNER));

  // Version and website
  console.log(chalk.gray(`  v${VERSION}  •  ${WEBSITE_URL}`));
  console.log(chalk.gray('─'.repeat(50)));

  // Config status
  const configStatus = options.configPath
    ? chalk.white(options.configPath)
    : chalk.gray('(none, using defaults)');
  console.log(`${chalk.gray('Config:')} ${configStatus}`);

  // Target URL
  console.log(`${chalk.gray('Auditing:')} ${chalk.white(extractDomain(options.url))}`);

  // Max pages (only in crawl mode)
  if (options.crawlMode && options.maxPages) {
    console.log(`${chalk.gray('Max pages:')} ${chalk.white(options.maxPages.toString())}`);
  }

  console.log();
}

/**
 * Render a compact 10-character progress bar
 * @param percentage - Value from 0-100
 * @returns Progress bar string like "█████░░░░░"
 */
export function renderCompactBar(percentage: number): string {
  const width = 10;
  const filled = Math.round((percentage / 100) * width);
  const empty = width - filled;

  const filledChar = '█';
  const emptyChar = '░';

  return filledChar.repeat(filled) + emptyChar.repeat(empty);
}

/**
 * Get color function based on score
 */
export function getScoreColor(score: number): (text: string) => string {
  if (score >= 90) return chalk.green;
  if (score >= 70) return chalk.yellow;
  if (score >= 50) return chalk.hex('#FFA500'); // Orange
  return chalk.red;
}

/**
 * Render horizontal separator line
 */
export function renderSeparator(width = 50): string {
  return chalk.gray('─'.repeat(width));
}
