import chalk from 'chalk';
import Table from 'cli-table3';
import { getAuditsDatabase, closeAuditsDatabase, domainOf } from '../storage/index.js';
import type { HydratedAudit, HydratedAuditResult } from '../storage/types.js';

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

/**
 * Rules that changed status between two audits.
 *
 * Compared by rule id rather than by counting statuses, so a rule that broke
 * and a different one that got fixed do not cancel out in the summary.
 */
interface RuleChange {
  ruleId: string;
  ruleName: string;
  categoryId: string;
  from: string;
  to: string;
  message: string;
}

function diffRules(
  previous: HydratedAuditResult[],
  current: HydratedAuditResult[]
): { regressed: RuleChange[]; improved: RuleChange[] } {
  // A rule can appear once per page in crawl mode; reduce to its worst status
  // so the diff reports the rule, not every page it touched.
  const rank: Record<string, number> = { pass: 0, warn: 1, fail: 2 };
  const worst = (results: HydratedAuditResult[]): Map<string, HydratedAuditResult> => {
    const map = new Map<string, HydratedAuditResult>();
    for (const result of results) {
      const existing = map.get(result.ruleId);
      if (!existing || (rank[result.status] ?? 0) > (rank[existing.status] ?? 0)) {
        map.set(result.ruleId, result);
      }
    }
    return map;
  };

  const before = worst(previous);
  const after = worst(current);

  const regressed: RuleChange[] = [];
  const improved: RuleChange[] = [];

  for (const [ruleId, now] of after) {
    const then = before.get(ruleId);
    if (!then || then.status === now.status) continue;

    const change: RuleChange = {
      ruleId,
      ruleName: now.ruleName,
      categoryId: now.categoryId,
      from: then.status,
      to: now.status,
      message: now.message,
    };

    if ((rank[now.status] ?? 0) > (rank[then.status] ?? 0)) {
      regressed.push(change);
    } else {
      improved.push(change);
    }
  }

  // Worst regressions first, so the top of the list is what to act on.
  regressed.sort((a, b) => (rank[b.to] ?? 0) - (rank[a.to] ?? 0));
  return { regressed, improved };
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
    console.error(chalk.red('Specify a domain or URL to compare.'));
    console.error(chalk.dim('  seomator compare example.com'));
    process.exit(1);
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
      console.error(chalk.yellow(`No stored audits for ${domain}.`));
      console.error(chalk.dim(`Run: seomator audit ${target} --save`));
      process.exit(1);
    }

    let previous: HydratedAudit | null;
    if (options.against) {
      previous = db.getAudit(options.against);
      if (!previous) {
        console.error(chalk.red(`Audit not found: ${options.against}`));
        process.exit(1);
      }
    } else {
      previous = db.getPreviousAudit(domain, current.auditId);
      if (!previous) {
        console.error(
          chalk.yellow(`Only one stored audit for ${domain}, so there is nothing to compare against.`)
        );
        console.error(chalk.dim(`Run another: seomator audit ${target} --save`));
        process.exit(1);
      }
    }

    const comparison = db.compareAudits(current.id, previous.id);
    const { regressed, improved } = diffRules(
      db.getResults(previous.id),
      db.getResults(current.id)
    );
    const scoreDelta = current.overallScore - previous.overallScore;

    if (options.json) {
      console.log(
        JSON.stringify(
          {
            domain,
            current: { auditId: current.auditId, score: current.overallScore, date: current.startedAt },
            previous: { auditId: previous.auditId, score: previous.overallScore, date: previous.startedAt },
            scoreDelta,
            categoryDeltas: comparison?.categoryDeltas ?? [],
            regressed,
            improved,
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

      if (regressed.length === 0 && improved.length === 0) {
        console.log(chalk.dim('  No rules changed status.'));
        console.log();
      }
    }

    const regressionFound = scoreDelta < 0 || regressed.length > 0;
    process.exitCode = options.failOnRegression && regressionFound ? 1 : 0;
  } finally {
    closeAuditsDatabase();
  }
}
