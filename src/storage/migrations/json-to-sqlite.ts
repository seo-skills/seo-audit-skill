import * as fs from 'fs';
import * as path from 'path';
import { getCrawlsDir, getReportsDir, extractDomain } from '../paths.js';
import { ProjectDatabase } from '../project-db/index.js';
import { getAuditsDatabase } from '../audits-db/index.js';
import type { StoredCrawl, StoredPage } from '../crawl-store.js';
import type { StoredReport } from '../report-store.js';
import type { InsertPageInput, InsertCategoryInput, InsertResultInput } from '../types.js';

/**
 * Migration result
 */
export interface MigrationStats {
  crawlsMigrated: number;
  crawlsSkipped: number;
  crawlErrors: string[];
  reportsMigrated: number;
  reportsSkipped: number;
  reportErrors: string[];
  backupCreated: boolean;
}

/**
 * Detect if there are JSON files to migrate
 */
export function detectJsonFiles(baseDir: string): {
  hasCrawls: boolean;
  hasReports: boolean;
  crawlCount: number;
  reportCount: number;
} {
  const crawlsDir = getCrawlsDir(baseDir);
  const reportsDir = getReportsDir(baseDir);

  let crawlCount = 0;
  let reportCount = 0;

  if (fs.existsSync(crawlsDir)) {
    crawlCount = fs.readdirSync(crawlsDir).filter(f => f.endsWith('.json')).length;
  }

  if (fs.existsSync(reportsDir)) {
    reportCount = fs.readdirSync(reportsDir).filter(f => f.endsWith('.json')).length;
  }

  return {
    hasCrawls: crawlCount > 0,
    hasReports: reportCount > 0,
    crawlCount,
    reportCount,
  };
}

/**
 * Backup a directory by renaming it with .bak suffix
 */
function backupDirectory(dir: string): boolean {
  if (!fs.existsSync(dir)) {
    return false;
  }

  const backupDir = `${dir}.bak`;

  // Remove existing backup if present
  if (fs.existsSync(backupDir)) {
    fs.rmSync(backupDir, { recursive: true, force: true });
  }

  fs.renameSync(dir, backupDir);
  return true;
}

/**
 * Convert stored page to insert input
 */
function pageToInsertInput(page: StoredPage): InsertPageInput {
  return {
    url: page.url,
    statusCode: page.status,
    depth: page.depth,
    html: page.html,
    headers: page.headers,
    loadTimeMs: page.loadTime,
    cwv: page.cwv ? {
      lcp: page.cwv.lcp,
      cls: page.cwv.cls,
      inp: page.cwv.inp,
      fcp: page.cwv.fcp,
      ttfb: page.cwv.ttfb,
    } : undefined,
  };
}

/**
 * Migrate a single crawl file to SQLite
 */
function migrateCrawl(
  filePath: string,
  projectDbs: Map<string, ProjectDatabase>
): { success: boolean; error?: string } {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const crawl: StoredCrawl = JSON.parse(content);

    // Extract domain from URL
    const domain = extractDomain(crawl.url);

    // Get or create project database
    let projectDb = projectDbs.get(domain);
    if (!projectDb) {
      projectDb = new ProjectDatabase(domain);
      projectDbs.set(domain, projectDb);
    }

    // Get or create project
    projectDb.getOrCreateProject(crawl.project);

    // Create crawl record
    const dbCrawl = projectDb.createCrawl({
      crawlId: crawl.id,
      startUrl: crawl.url,
      config: crawl.config,
    });

    // Insert pages
    if (crawl.pages && crawl.pages.length > 0) {
      const pageInputs = crawl.pages.map(pageToInsertInput);
      projectDb.insertPages(dbCrawl.id, pageInputs);
    }

    // Complete the crawl
    projectDb.completeCrawl(crawl.id, {
      totalPages: crawl.stats?.totalPages ?? crawl.pages?.length ?? 0,
      duration: crawl.stats?.duration ?? 0,
      errorCount: crawl.stats?.errorCount ?? 0,
    });

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Migrate a single report file to SQLite
 */
function migrateReport(
  filePath: string,
  auditsDb: AuditsDatabase
): { success: boolean; error?: string } {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const report: StoredReport = JSON.parse(content);

    // Extract domain from URL
    const domain = extractDomain(report.url);

    // Create audit record
    const audit = auditsDb.createAudit({
      auditId: report.id,
      domain,
      projectName: report.project,
      crawlId: report.crawlId || undefined,
      startUrl: report.url,
      config: report.config,
    });

    // Insert category results
    if (report.categoryResults && report.categoryResults.length > 0) {
      const categoryInputs: InsertCategoryInput[] = report.categoryResults.map(cat => ({
        categoryId: cat.categoryId,
        categoryName: cat.categoryId, // Legacy format doesn't have name
        score: cat.score,
        weight: 100 / report.categoryResults.length, // Approximate weight
        passCount: cat.passCount,
        warnCount: cat.warnCount,
        failCount: cat.failCount,
      }));

      auditsDb.insertCategories(audit.id, categoryInputs);

      // Insert rule results
      const resultInputs: InsertResultInput[] = [];
      for (const cat of report.categoryResults) {
        if (cat.results) {
          for (const result of cat.results) {
            resultInputs.push({
              categoryId: cat.categoryId,
              ruleId: result.ruleId,
              ruleName: result.ruleId, // Legacy format uses ruleId as name
              pageUrl: report.url,
              status: result.status,
              score: result.score,
              message: result.message,
              details: result.details,
            });
          }
        }
      }

      if (resultInputs.length > 0) {
        auditsDb.insertResults(audit.id, resultInputs);
      }
    }

    // Complete the audit
    auditsDb.completeAudit(report.id, {
      overallScore: report.overallScore,
      totalRules: report.stats?.totalRules ?? 0,
      passedCount: report.stats?.passed ?? 0,
      warningCount: report.stats?.warnings ?? 0,
      failedCount: report.stats?.failed ?? 0,
      pagesAudited: 1,
    });

    // Generate issues from results
    auditsDb.generateIssuesFromResults(audit.id);

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Migrate all JSON files to SQLite
 *
 * @param baseDir - Base directory to scan
 * @param options - Migration options
 * @returns Migration statistics
 */
export function migrateJsonToSqlite(
  baseDir: string,
  options: {
    dryRun?: boolean;
    backup?: boolean;
  } = {}
): MigrationStats {
  const stats: MigrationStats = {
    crawlsMigrated: 0,
    crawlsSkipped: 0,
    crawlErrors: [],
    reportsMigrated: 0,
    reportsSkipped: 0,
    reportErrors: [],
    backupCreated: false,
  };

  const crawlsDir = getCrawlsDir(baseDir);
  const reportsDir = getReportsDir(baseDir);

  // Dry run - just count files
  if (options.dryRun) {
    const detection = detectJsonFiles(baseDir);
    stats.crawlsMigrated = detection.crawlCount;
    stats.reportsMigrated = detection.reportCount;
    return stats;
  }

  // Track project databases for reuse
  const projectDbs = new Map<string, ProjectDatabase>();

  try {
    // Migrate crawls
    if (fs.existsSync(crawlsDir)) {
      const crawlFiles = fs.readdirSync(crawlsDir)
        .filter(f => f.endsWith('.json'))
        .map(f => path.join(crawlsDir, f));

      for (const filePath of crawlFiles) {
        const result = migrateCrawl(filePath, projectDbs);
        if (result.success) {
          stats.crawlsMigrated++;
        } else {
          stats.crawlErrors.push(`${path.basename(filePath)}: ${result.error}`);
        }
      }

      // Backup crawls directory
      if (options.backup !== false && stats.crawlsMigrated > 0) {
        if (backupDirectory(crawlsDir)) {
          stats.backupCreated = true;
        }
      }
    }

    // Get audits database
    const auditsDb = getAuditsDatabase();

    // Migrate reports
    if (fs.existsSync(reportsDir)) {
      const reportFiles = fs.readdirSync(reportsDir)
        .filter(f => f.endsWith('.json'))
        .map(f => path.join(reportsDir, f));

      for (const filePath of reportFiles) {
        const result = migrateReport(filePath, auditsDb);
        if (result.success) {
          stats.reportsMigrated++;
        } else {
          stats.reportErrors.push(`${path.basename(filePath)}: ${result.error}`);
        }
      }

      // Backup reports directory
      if (options.backup !== false && stats.reportsMigrated > 0) {
        if (backupDirectory(reportsDir)) {
          stats.backupCreated = true;
        }
      }
    }
  } finally {
    // Close all project databases
    for (const db of projectDbs.values()) {
      db.close();
    }
  }

  return stats;
}

/**
 * Check migration status
 */
export function getMigrationStatus(baseDir: string): {
  needsMigration: boolean;
  crawlsToMigrate: number;
  reportsToMigrate: number;
  hasBackup: boolean;
} {
  const detection = detectJsonFiles(baseDir);
  const crawlsBackup = fs.existsSync(`${getCrawlsDir(baseDir)}.bak`);
  const reportsBackup = fs.existsSync(`${getReportsDir(baseDir)}.bak`);

  return {
    needsMigration: detection.hasCrawls || detection.hasReports,
    crawlsToMigrate: detection.crawlCount,
    reportsToMigrate: detection.reportCount,
    hasBackup: crawlsBackup || reportsBackup,
  };
}

/**
 * Restore from backup (rollback migration)
 */
export function restoreFromBackup(baseDir: string): boolean {
  const crawlsDir = getCrawlsDir(baseDir);
  const reportsDir = getReportsDir(baseDir);
  const crawlsBackup = `${crawlsDir}.bak`;
  const reportsBackup = `${reportsDir}.bak`;

  let restored = false;

  if (fs.existsSync(crawlsBackup)) {
    if (fs.existsSync(crawlsDir)) {
      fs.rmSync(crawlsDir, { recursive: true, force: true });
    }
    fs.renameSync(crawlsBackup, crawlsDir);
    restored = true;
  }

  if (fs.existsSync(reportsBackup)) {
    if (fs.existsSync(reportsDir)) {
      fs.rmSync(reportsDir, { recursive: true, force: true });
    }
    fs.renameSync(reportsBackup, reportsDir);
    restored = true;
  }

  return restored;
}
