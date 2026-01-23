import * as fs from 'fs';
import * as path from 'path';
import type { PartialSeomatorConfig } from '../config/schema.js';
import type { CategoryResult } from '../types.js';
import { getReportsDir, generateId } from './paths.js';

/**
 * Stored report data
 */
export interface StoredReport {
  id: string;
  crawlId: string;
  url: string;
  project: string;
  timestamp: string;
  config: PartialSeomatorConfig;
  overallScore: number;
  categoryResults: CategoryResult[];
  stats: {
    totalRules: number;
    passed: number;
    warnings: number;
    failed: number;
  };
}

/**
 * Report summary for listing
 */
export interface ReportSummary {
  id: string;
  crawlId: string;
  url: string;
  project: string;
  timestamp: string;
  overallScore: number;
}

/**
 * Ensure reports directory exists
 */
function ensureReportsDir(baseDir: string): string {
  const reportsDir = getReportsDir(baseDir);
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }
  return reportsDir;
}

/**
 * Save a report to disk
 */
export function saveReport(baseDir: string, report: StoredReport): string {
  const reportsDir = ensureReportsDir(baseDir);
  const filePath = path.join(reportsDir, `${report.id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(report, null, 2), 'utf-8');
  return report.id;
}

/**
 * Load a report from disk
 */
export function loadReport(baseDir: string, id: string): StoredReport | null {
  const reportsDir = getReportsDir(baseDir);
  const filePath = path.join(reportsDir, `${id}.json`);

  if (!fs.existsSync(filePath)) {
    return null;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content);
}

/**
 * List all reports with optional filtering
 */
export function listReports(
  baseDir: string,
  options: {
    project?: string;
    since?: Date;
  } = {}
): ReportSummary[] {
  const reportsDir = getReportsDir(baseDir);

  if (!fs.existsSync(reportsDir)) {
    return [];
  }

  const files = fs.readdirSync(reportsDir).filter(f => f.endsWith('.json'));
  const summaries: ReportSummary[] = [];

  for (const file of files) {
    const filePath = path.join(reportsDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const report: StoredReport = JSON.parse(content);

    // Apply filters
    if (options.project && report.project !== options.project) {
      continue;
    }
    if (options.since && new Date(report.timestamp) < options.since) {
      continue;
    }

    summaries.push({
      id: report.id,
      crawlId: report.crawlId,
      url: report.url,
      project: report.project,
      timestamp: report.timestamp,
      overallScore: report.overallScore,
    });
  }

  // Sort by timestamp descending
  return summaries.sort((a, b) =>
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

/**
 * Get the most recent report
 */
export function getLatestReport(baseDir: string): StoredReport | null {
  const list = listReports(baseDir);
  if (list.length === 0) {
    return null;
  }
  return loadReport(baseDir, list[0].id);
}

/**
 * Create a new report from audit results
 */
export function createReport(
  crawlId: string,
  url: string,
  project: string,
  config: PartialSeomatorConfig,
  overallScore: number,
  categoryResults: CategoryResult[]
): StoredReport {
  // Calculate stats
  let passed = 0;
  let warnings = 0;
  let failed = 0;

  for (const cat of categoryResults) {
    passed += cat.passCount;
    warnings += cat.warnCount;
    failed += cat.failCount;
  }

  return {
    id: generateId(),
    crawlId,
    url,
    project,
    timestamp: new Date().toISOString(),
    config,
    overallScore,
    categoryResults,
    stats: {
      totalRules: passed + warnings + failed,
      passed,
      warnings,
      failed,
    },
  };
}
