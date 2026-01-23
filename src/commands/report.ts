import chalk from 'chalk';
import Table from 'cli-table3';
import { listReports, loadReport } from '../storage/index.js';
import { renderTerminalReport, outputJsonReport } from '../reporters/index.js';

export interface ReportOptions {
  list: boolean;
  project?: string;
  since?: string;
  format: 'table' | 'json';
}

export async function runReport(query: string | undefined, options: ReportOptions): Promise<void> {
  const baseDir = process.cwd();

  if (options.list || !query) {
    // List reports
    const since = options.since ? new Date(options.since) : undefined;
    const reports = listReports(baseDir, {
      project: options.project,
      since,
    });

    if (reports.length === 0) {
      console.log(chalk.yellow('No reports found.'));
      return;
    }

    if (options.format === 'json') {
      console.log(JSON.stringify(reports, null, 2));
      return;
    }

    // Table format
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
  } else {
    // Show specific report
    const report = loadReport(baseDir, query);

    if (!report) {
      console.error(chalk.red(`Report not found: ${query}`));
      process.exit(1);
    }

    if (options.format === 'json') {
      console.log(JSON.stringify(report, null, 2));
    } else {
      // Convert to AuditResult format
      const result = {
        url: report.url,
        overallScore: report.overallScore,
        categoryResults: report.categoryResults,
        timestamp: report.timestamp,
        crawledPages: 1,
      };
      renderTerminalReport(result);
    }
  }
}
