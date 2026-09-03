import chalk from 'chalk';
import { scoreToVerdict, type VerdictToken } from '../verdict.js';
import { getVersion } from '../version.js';

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
 * CLI version, read from package.json so the banner cannot drift from the
 * released version the way a hardcoded string does.
 */
const VERSION = getVersion();

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
 * Get letter grade for a score.
 *
 * The buckets live in `src/verdict.ts` now; this only maps the shared token to
 * a chalk colour. Previously this function *was* one of three disagreeing
 * grade scales.
 *
 * @param score - Score from 0-100, or null when nothing could be measured
 * @returns Letter grade and color function
 */
export function getLetterGrade(score: number | null): LetterGradeResult {
  const verdict = scoreToVerdict(score);
  return { grade: verdict.grade, color: TOKEN_COLORS[verdict.colorToken] };
}

/** The one place a verdict token becomes a terminal colour */
const TOKEN_COLORS: Record<VerdictToken, (text: string) => string> = {
  pass: chalk.green,
  warn: chalk.yellow,
  orange: chalk.hex('#FFA500'),
  fail: chalk.red,
  neutral: chalk.gray,
};

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
export function getScoreColor(score: number | null): (text: string) => string {
  // Derived from the same buckets as the grade, so a score cannot be green
  // here and amber in the report — colour used to be a fourth grade scale.
  return TOKEN_COLORS[scoreToVerdict(score).colorToken];
}

/**
 * Render horizontal separator line
 */
export function renderSeparator(width = 50): string {
  return chalk.gray('─'.repeat(width));
}
