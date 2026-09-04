import chalk from 'chalk';
import { emitCommandError } from './machine-error.js';
import Table from 'cli-table3';
import { getAuditsDatabase, closeAuditsDatabase, domainOf, diffRules } from '../storage/index.js';
import {
  compareRunProfiles,
  hasMaterialDifference,
} from '../storage/audits-db/run-profile.js';
import type { HydratedAudit } from '../storage/types.js';
import type { RuleChange } from '../storage/index.js';

export interface CompareOptions {
  /** Compare against this audit id instead of the previous run */
  against?: string;
  /** Show the score history for the domain instead of a two-run diff */
  trend: boolean;
  /** Emit JSON rather than a table */
  json: boolean;
  /** Exit non-zero when the score dropped or new failures appeared */
  failOnRegression: boolean;
}

/** Colour a delta by direction, with an explicit sign */
function formatDelta(delta: number): string {
  if (delta > 0) return chalk.green(`+${delta}`);
  if (delta < 0) return chalk.red(`${delta}`);
  return chalk.dim('0');
}

/** Glyph for a rule's current status */
function statusGlyph(status: RuleChange['to']): string {
  if (status === 'fail') return chalk.red('✗');
  if (status === 'warn') return chalk.yellow('⚠');
  return chalk.green('✓');
}

/** "on 3 of 12 pages" for crawl audits, empty for single-page ones */
function pageCount(change: RuleChange): string {
  if (change.totalPages <= 1) return '';
  return `on ${change.affectedPages} of ${change.totalPages} pages`;
}

/** A short arrow showing which way a score moved */
function trendGlyph(delta: number): string {
  if (delta > 0) return chalk.green('▲');
  if (delta < 0) return chalk.red('▼');
  return chalk.dim('=');
}

/**
 * Render an audit timestamp in the reader's own timezone.
 *
 * `toISOString()` renders UTC, and printed bare it reads as local time: an
 * audit run at 18:04 in UTC+3 came out as "15:04", three hours before the
 * command that produced it. Every other surface — `report --list`, the HTML
 * report, the Markdown report — uses local time, so this was the one clock in
 * the CLI that disagreed with the rest.
 *
 * @param date - The instant to render
 * @returns 'YYYY-MM-DD HH:MM' in local time
 */
export function formatDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}


/** Print the score history for a domain */
function renderTrend(domain: string, json: boolean): number {
  const db = getAuditsDatabase();
  const trend = db.getScoreTrend(domain, 20);

  if (trend.length === 0) {
    console.log(chalk.yellow(`No stored audits for ${domain}.`));
    console.log(chalk.dim(`Run: seomator audit https://${domain} --save`));
    return 1;
  }

  if (json) {
    console.log(JSON.stringify({ domain, trend }, null, 2));
    return 0;
  }

  console.log();
  console.log(chalk.bold(`Score history — ${domain}`));
  console.log();

  let previousScore: number | null = null;
  for (const point of trend) {
    const delta = previousScore === null ? null : point.score - previousScore;
    const bar = '█'.repeat(Math.max(1, Math.round(point.score / 4)));
    const scoreColor = point.score >= 80 ? chalk.green : point.score >= 60 ? chalk.yellow : chalk.red;
    console.log(
      `  ${chalk.dim(formatDate(point.date))}  ${scoreColor(String(point.score).padStart(3))}  ` +
        `${scoreColor(bar)}${delta === null ? '' : `  ${trendGlyph(delta)} ${formatDelta(delta)}`}`
    );
    previousScore = point.score;
  }
  console.log();
  return 0;
}

/**
 * Compare two audits of the same site.
 *
 * With no `--against`, compares the latest audit against the one before it,
 * which is the question people actually ask: did this deploy make things worse?
 */
export async function runCompare(
  target: string | undefined,
  options: CompareOptions
): Promise<void> {
  if (!target) {
    emitCommandError({
      json: options.json === true,
      code: 'no-target',
      message: 'Specify a domain or URL to compare.',
      hint: 'seomator compare example.com',
    });
    return;
  }

  const domain = domainOf(target.includes('://') ? target : `https://${target}`);

  try {
    if (options.trend) {
      // Returning rather than exiting lets stdout drain and lets the finally
      // below actually close the database — process.exit() skips finally.
      process.exitCode = renderTrend(domain, options.json);
      return;
    }

    const db = getAuditsDatabase();
    const current = db.getLatestAudit(domain);

    if (!current) {
      emitCommandError({
        json: options.json === true,
        code: 'no-audits',
        message: `No stored audits for ${domain}.`,
        hint: `Run: seomator audit ${target} --save`,
      });
      return;
    }

    let previous: HydratedAudit | null;
    if (options.against) {
      previous = db.getAudit(options.against);
      if (!previous) {
        emitCommandError({
          json: options.json === true,
          code: 'audit-not-found',
          message: `Audit not found: ${options.against}`,
          hint: 'List what is stored with: seomator report --list',
        });
        return;
      }
    } else {
      previous = db.getPreviousAudit(domain, current.auditId);
      if (!previous) {
        emitCommandError({
          json: options.json === true,
          code: 'nothing-to-compare',
          message: `Only one stored audit for ${domain}, so there is nothing to compare against.`,
          hint: `Run another: seomator audit ${target} --save`,
        });
        return;
      }
    }

    // Reads only: a comparison is computed on demand here and stored once,
    // by the save path, when the audit is written.
    const comparison = db.buildComparison(current.id, previous.id);
    const { regressed, improved, added, removed } = diffRules(
      db.getAllResults(previous.id),
      db.getAllResults(current.id)
    );
    const scoreDelta = current.overallScore - previous.overallScore;
    const engineChanged = comparison?.engineChanged ?? false;
    // Two scores are only comparable if both were measured the same way. Until
    // now this warned about the engine version and said nothing about the run
    // options, so a baseline from the desktop app (Core Web Vitals off) versus
    // a CLI run (on) looked like the site had regressed.
    const profileDifferences = compareRunProfiles(previous.run, current.run);

    if (options.json) {
      console.log(
        JSON.stringify(
          {
            domain,
            current: { auditId: current.auditId, score: current.overallScore, date: current.startedAt },
            previous: { auditId: previous.auditId, score: previous.overallScore, date: previous.startedAt },
            scoreDelta,
            engineChanged,
            comparable: !hasMaterialDifference(profileDifferences),
            runDifferences: profileDifferences,
            engineVersions: {
              current: current.engineVersion,
              previous: previous.engineVersion,
            },
            categoryDeltas: comparison?.categoryDeltas ?? [],
            regressed,
            improved,
            added,
            removed,
          },
          null,
          2
        )
      );
    } else {
      console.log();
      console.log(chalk.bold(`Comparing ${domain}`));
      console.log(
        chalk.dim(
          `  previous  ${previous.auditId}  ${formatDate(previous.startedAt)}  score ${previous.overallScore}`
        )
      );
      console.log(
        chalk.dim(
          `  current   ${current.auditId}  ${formatDate(current.startedAt)}  score ${current.overallScore}`
        )
      );
      console.log();
      console.log(
        `  Overall  ${previous.overallScore} → ${current.overallScore}  ${trendGlyph(scoreDelta)} ${formatDelta(scoreDelta)}`
      );
      if (engineChanged) {
        console.log(
          chalk.yellow(
            `  Engine changed: ${previous.engineVersion} → ${current.engineVersion}. Some differences may come from rule updates rather than the site.`
          )
        );
      }
      if (profileDifferences.length > 0) {
        const material = hasMaterialDifference(profileDifferences);
        const lead = material
          ? '  These audits were not measured the same way, so this diff is not a like-for-like comparison:'
          : '  These audits covered different amounts of the site:';
        console.log(material ? chalk.yellow(lead) : chalk.dim(lead));
        for (const difference of profileDifferences) {
          console.log(
            (material ? chalk.yellow : chalk.dim)(
              `    ${difference.option}: ${difference.previous} → ${difference.current}`
            )
          );
        }
      }
      console.log();

      const moved = (comparison?.categoryDeltas ?? []).filter((d) => d.delta !== 0);
      if (moved.length > 0) {
        const table = new Table({
          head: ['Category', 'Before', 'After', 'Change'],
          colWidths: [24, 9, 9, 10],
          style: { head: ['dim'] },
        });
        for (const delta of moved.sort((a, b) => a.delta - b.delta)) {
          table.push([
            delta.categoryName,
            String(delta.previousScore),
            String(delta.currentScore),
            formatDelta(delta.delta),
          ]);
        }
        console.log(table.toString());
        console.log();
      } else {
        console.log(chalk.dim('  No category scores changed.'));
        console.log();
      }

      if (regressed.length > 0) {
        console.log(chalk.red.bold(`  Regressed (${regressed.length})`));
        for (const change of regressed.slice(0, 15)) {
          console.log(
            `    ${chalk.red('✗')} ${chalk.bold(change.ruleId)} ${chalk.dim(`${change.from} → ${change.to}`)}`
          );
          console.log(`      ${chalk.dim(change.message.slice(0, 100))}`);
        }
        if (regressed.length > 15) {
          console.log(chalk.dim(`    …and ${regressed.length - 15} more`));
        }
        console.log();
      }

      if (improved.length > 0) {
        console.log(chalk.green.bold(`  Improved (${improved.length})`));
        for (const change of improved.slice(0, 10)) {
          console.log(
            `    ${chalk.green('✓')} ${chalk.bold(change.ruleId)} ${chalk.dim(`${change.from} → ${change.to}`)}`
          );
        }
        if (improved.length > 10) {
          console.log(chalk.dim(`    …and ${improved.length - 10} more`));
        }
        console.log();
      }

      if (added.length > 0) {
        console.log(chalk.bold(`  New in this audit (${added.length})`));
        for (const change of added.slice(0, 10)) {
          console.log(`    ${statusGlyph(change.to)} ${chalk.bold(change.ruleId)} ${chalk.dim(pageCount(change))}`);
        }
        if (added.length > 10) {
          console.log(chalk.dim(`    …and ${added.length - 10} more`));
        }
        console.log();
      }

      if (removed.length > 0) {
        console.log(chalk.bold(`  No longer measured (${removed.length})`));
        for (const change of removed.slice(0, 10)) {
          console.log(`    ${chalk.dim('·')} ${chalk.bold(change.ruleId)} ${chalk.dim(`was ${change.from}`)}`);
        }
        if (removed.length > 10) {
          console.log(chalk.dim(`    …and ${removed.length - 10} more`));
        }
        console.log();
      }

      if (regressed.length === 0 && improved.length === 0 && added.length === 0 && removed.length === 0) {
        console.log(chalk.dim('  No rules changed status.'));
        console.log();
      }
    }

    // A run measured differently is not a regression. Failing CI because the
    // baseline came from a surface with different defaults is the bug this
    // check exists to avoid, not a signal worth acting on.
    const notComparable = hasMaterialDifference(profileDifferences);
    const regressionFound = !notComparable && (scoreDelta < 0 || regressed.length > 0);
    if (options.failOnRegression && notComparable) {
      console.log(
        chalk.yellow(
          '  Not failing on regression: the two audits were measured differently, so any difference is not attributable to the site.'
        )
      );
    }
    process.exitCode = options.failOnRegression && regressionFound ? 1 : 0;
  } finally {
    closeAuditsDatabase();
  }
}
