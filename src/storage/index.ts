// =============================================================================
// Legacy exports (maintained for backwards compatibility)
// =============================================================================
export * from './paths.js';
export * from './crawl-store.js';
export * from './report-store.js';
export * from './link-cache.js';

// =============================================================================
// New SQLite storage exports
export {
  saveAuditToDatabase,
  domainOf,
  stripUserinfo,
  withBusyRetry,
  type SavedAudit,
  type SaveAuditOptions,
  type BusyRetryOptions,
} from './save-audit.js';
// =============================================================================

// Types for database records
export * from './types.js';

// Utility functions
export * from './utils/index.js';

// Project database (per-domain crawl storage)
export {
  ProjectDatabase,
  openProjectDatabase,
  type HydratedProject,
  type HydratedCrawl,
  type HydratedPage,
  type HydratedPageWithHtml,
  type HydratedLink,
  type HydratedImage,
  type CrawlSummary,
  type CrawlStats,
  type CrawlStatus,
  type CrawlQueryOptions,
  type PageQueryOptions,
  type CreateCrawlInput,
  type InsertPageInput,
  type InsertLinkInput,
  type InsertImageInput,
} from './project-db/index.js';

// Audits database (centralized audit storage)
export {
  AuditsDatabase,
  getAuditsDatabase,
  closeAuditsDatabase,
  diffRules,
  rollupByRule,
  type RuleChange,
  type RuleDiff,
  type AuditComparison,
  type ScoreTrendPoint,
  type StoredRuleSummary,
  type HydratedAudit,
  type HydratedAuditCategory,
  type HydratedAuditResult,
  type HydratedIssue,
  type HydratedAuditComparison,
  type AuditSummary,
  type AuditQueryOptions,
  type RuleResultQueryOptions,
  type IssueQueryOptions,
  type CreateAuditInput,
  type InsertCategoryInput,
  type InsertResultInput,
  type InsertIssueInput,
  type RuleResultStatus,
  type IssueSeverity,
  type CategoryDelta,
} from './audits-db/index.js';

// Migrations
export {
  runMigrations,
  rollbackMigrations,
  getMigrationStatus as getDbMigrationStatus,
  createMigrationRunner,
} from './migrations/index.js';

export {
  migrateJsonToSqlite,
  detectJsonFiles,
  getMigrationStatus as getJsonMigrationStatus,
  restoreFromBackup,
  type MigrationStats,
} from './migrations/json-to-sqlite.js';
