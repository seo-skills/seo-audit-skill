import chalk from 'chalk';
import * as fs from 'fs';
import {
  migrateJsonToSqlite,
  detectJsonFiles,
  getJsonMigrationStatus,
  restoreFromBackup,
  getProjectsDir,
  getAuditsDbPath,
  getGlobalDir,
} from '../storage/index.js';

export interface DbMigrateOptions {
  dryRun: boolean;
  noBackup: boolean;
}

export interface DbStatsOptions {
  verbose: boolean;
}

export interface DbRestoreOptions {
  // No options yet
}

/**
 * Format bytes to human readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

/**
 * Run database migration from JSON to SQLite
 */
export async function runDbMigrate(options: DbMigrateOptions): Promise<void> {
  const baseDir = process.cwd();

  console.log(chalk.blue('SEOmator Database Migration'));
  console.log();

  // Check what needs to be migrated
  const detection = detectJsonFiles(baseDir);

  if (!detection.hasCrawls && !detection.hasReports) {
    console.log(chalk.yellow('No JSON files found to migrate.'));
    console.log();
    console.log('Migration looks for:');
    console.log('  - .seomator/crawls/*.json');
    console.log('  - .seomator/reports/*.json');
    console.log();
    return;
  }

  console.log('Files to migrate:');
  console.log(`  Crawl files: ${detection.crawlCount}`);
  console.log(`  Report files: ${detection.reportCount}`);
  console.log();

  if (options.dryRun) {
    console.log(chalk.yellow('Dry run mode - no changes will be made'));
    console.log();
    console.log('Would migrate to:');
    console.log(`  Crawls → ~/.seomator/projects/<domain>/project.db`);
    console.log(`  Reports → ~/.seomator/audits.db`);
    console.log();
    return;
  }

  // Run migration
  console.log('Starting migration...');
  console.log();

  const stats = migrateJsonToSqlite(baseDir, {
    dryRun: false,
    backup: !options.noBackup,
  });

  // Report results
  console.log(chalk.green('Migration complete!'));
  console.log();
  console.log('Results:');
  console.log(`  Crawls migrated: ${stats.crawlsMigrated}`);
  console.log(`  Crawls skipped: ${stats.crawlsSkipped}`);
  console.log(`  Reports migrated: ${stats.reportsMigrated}`);
  console.log(`  Reports skipped: ${stats.reportsSkipped}`);

  if (stats.backupCreated) {
    console.log();
    console.log(chalk.dim('Original JSON files backed up to .bak directories'));
  }

  if (stats.crawlErrors.length > 0 || stats.reportErrors.length > 0) {
    console.log();
    console.log(chalk.red('Errors:'));
    for (const error of stats.crawlErrors) {
      console.log(chalk.red(`  Crawl: ${error}`));
    }
    for (const error of stats.reportErrors) {
      console.log(chalk.red(`  Report: ${error}`));
    }
  }

  console.log();
}

/**
 * Show database statistics
 */
export async function runDbStats(options: DbStatsOptions): Promise<void> {
  console.log(chalk.blue('SEOmator Database Statistics'));
  console.log();

  const globalDir = getGlobalDir();
  const projectsDir = getProjectsDir();
  const auditsDbPath = getAuditsDbPath();

  // Check if directories exist
  if (!fs.existsSync(globalDir)) {
    console.log(chalk.yellow('No SEOmator data found.'));
    console.log(`Expected location: ${globalDir}`);
    console.log();
    return;
  }

  // List project databases
  console.log(chalk.bold('Project Databases:'));

  if (fs.existsSync(projectsDir)) {
    const projects = fs.readdirSync(projectsDir).filter(d => {
      const dbPath = `${projectsDir}/${d}/project.db`;
      return fs.existsSync(dbPath);
    });

    if (projects.length === 0) {
      console.log('  No project databases found');
    } else {
      for (const project of projects) {
        const dbPath = `${projectsDir}/${project}/project.db`;
        const stats = fs.statSync(dbPath);
        console.log(`  ${project}: ${formatBytes(stats.size)}`);

        if (options.verbose) {
          // Open and get stats
          const { ProjectDatabase } = await import('../storage/project-db/index.js');
          const db = new ProjectDatabase(project);
          const dbStats = db.getStats();
          console.log(`    Crawls: ${dbStats.crawls}`);
          console.log(`    Pages: ${dbStats.pages}`);
          console.log(`    Links: ${dbStats.links}`);
          console.log(`    Images: ${dbStats.images}`);
          db.close();
        }
      }
    }
  } else {
    console.log('  No project databases found');
  }

  console.log();

  // Audits database
  console.log(chalk.bold('Audits Database:'));

  if (fs.existsSync(auditsDbPath)) {
    const stats = fs.statSync(auditsDbPath);
    console.log(`  Size: ${formatBytes(stats.size)}`);

    if (options.verbose) {
      const { getAuditsDatabase, closeAuditsDatabase } = await import('../storage/audits-db/index.js');
      const db = getAuditsDatabase();
      const dbStats = db.getStats();
      console.log(`  Audits: ${dbStats.audits}`);
      console.log(`  Results: ${dbStats.results}`);
      console.log(`  Issues: ${dbStats.issues}`);
      console.log(`  Comparisons: ${dbStats.comparisons}`);
      closeAuditsDatabase();
    }
  } else {
    console.log('  Not created yet');
  }

  console.log();

  // Link cache
  const linkCachePath = `${globalDir}/link-cache.db`;
  console.log(chalk.bold('Link Cache:'));

  if (fs.existsSync(linkCachePath)) {
    const stats = fs.statSync(linkCachePath);
    console.log(`  Size: ${formatBytes(stats.size)}`);
  } else {
    console.log('  Not created yet');
  }

  console.log();

  // Migration status
  const migrationStatus = getJsonMigrationStatus(process.cwd());
  if (migrationStatus.needsMigration) {
    console.log(chalk.yellow('Pending Migration:'));
    console.log(`  Crawl files to migrate: ${migrationStatus.crawlsToMigrate}`);
    console.log(`  Report files to migrate: ${migrationStatus.reportsToMigrate}`);
    console.log();
    console.log('Run: seomator db migrate');
    console.log();
  }
}

/**
 * Restore from backup (rollback migration)
 */
export async function runDbRestore(_options: DbRestoreOptions): Promise<void> {
  const baseDir = process.cwd();

  console.log(chalk.blue('SEOmator Restore from Backup'));
  console.log();

  const migrationStatus = getJsonMigrationStatus(baseDir);

  if (!migrationStatus.hasBackup) {
    console.log(chalk.yellow('No backup found to restore.'));
    console.log();
    console.log('Backups are created during migration at:');
    console.log('  .seomator/crawls.bak/');
    console.log('  .seomator/reports.bak/');
    console.log();
    return;
  }

  console.log('Restoring original JSON files...');
  console.log();

  const restored = restoreFromBackup(baseDir);

  if (restored) {
    console.log(chalk.green('Backup restored successfully!'));
    console.log();
    console.log('Your original JSON files are back in place.');
    console.log(chalk.dim('Note: SQLite databases were not deleted. You may remove them manually if needed.'));
  } else {
    console.log(chalk.red('Failed to restore backup.'));
  }

  console.log();
}
