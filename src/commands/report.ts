import chalk from 'chalk';
import Table from 'cli-table3';
import {
  listReports,
  loadReport,
  getAuditsDatabase,
  closeAuditsDatabase,
} from '../storage/index.js';
import { getAuditDetail, listAudits } from '../dashboard/queries.js';
import { renderTerminalReport, outputJsonReport } from '../reporters/index.js';

export interface ReportOptions {
  list: boolean;
  project?: string;
  since?: string;
  format: 'table' | 'json';
}

/** Local wall-clock rendering, the same as `compare` and the reports */
function formatLocal(iso: string): string {
  return new Date(iso).toLocaleString();
}

/**
 * View stored audits.
 *
 * Reads the audits database first, which is where every run has been stored
 * since 3.4.0. The per-project JSON store under `.seomator/reports/` is still
 * consulted so reports written by older versions, or with `--json-report`,
 * stay reachable.
 */
export async function runReport(query: string | undefined, options: ReportOptions): Promise<void> {
  const baseDir = process.cwd();

  try {
    if (options.list || !query) {
      const since = options.since ? new Date(options.since) : undefined;
      const db = getAuditsDatabase();
      const audits = listAudits(db, {
        ...(options.project && { projectName: options.project }),
        ...(since && { since }),
        limit: 100,
      });

      if (audits.length > 0) {
        if (options.format === 'json') {
          console.log(JSON.stringify(audits, null, 2));
          return;
        }

        const table = new Table({
          head: ['ID', 'URL', 'Project', 'Score', 'Pages', 'Date'],
          colWidths: [20, 40, 15, 8, 7, 22],
        });
        for (const audit of audits) {
          const scoreColor = audit.overallScore >= 70 ? chalk.green : chalk.red;
          table.push([
            audit.auditId,
            audit.startUrl.slice(0, 38),
            audit.projectName || '-',
            scoreColor(String(audit.overallScore)),
            String(audit.pagesAudited),
            formatLocal(audit.startedAt),
          ]);
        }
        console.log(table.toString());
        return;
      }

      // Nothing in the database: fall back to the legacy JSON store
      const reports = listReports(baseDir, { project: options.project, since });
      if (reports.length === 0) {
        console.log(chalk.yellow('No audits stored yet. Run `seomator audit <url>` to create one.'));
        return;
      }

      if (options.format === 'json') {
        console.log(JSON.stringify(reports, null, 2));
        return;
      }

      const table = new Table({
        head: ['ID', 'URL', 'Project', 'Score', 'Date'],
        colWidths: [20, 40, 15, 8, 22],
      });
      for (const report of reports) {
        const scoreColor = report.overallScore >= 70 ? chalk.green : chalk.red;
        table.push([
          report.id,
          report.url.slice(0, 38),
          report.project || '-',
          scoreColor(report.overallScore.toString()),
          new Date(report.timestamp).toLocaleString(),
        ]);
      }
      console.log(table.toString());
      console.log(chalk.dim('  Showing legacy JSON reports. Run `seomator db migrate` to move them into the audits database.'));
      return;
    }

    // A specific audit: database first, JSON store second
    const db = getAuditsDatabase();
    const detail = getAuditDetail(db, query);
    if (detail) {
      if (options.format === 'json') {
        console.log(JSON.stringify(detail, null, 2));
      } else {
        renderTerminalReport(detail.result);
      }
      return;
    }

    const report = loadReport(baseDir, query);
    if (!report) {
      console.error(chalk.red(`Audit not found: ${query}`));
      process.exitCode = 1;
      return;
    }

    if (options.format === 'json') {
      outputJsonReport({
        url: report.url,
        overallScore: report.overallScore,
        categoryResults: report.categoryResults,
        timestamp: report.timestamp,
        crawledPages: 1,
      });
    } else {
      renderTerminalReport({
        url: report.url,
        overallScore: report.overallScore,
        categoryResults: report.categoryResults,
        timestamp: report.timestamp,
        crawledPages: 1,
      });
    }
  } finally {
    closeAuditsDatabase();
  }
}
