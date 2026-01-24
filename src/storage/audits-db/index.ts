import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import { getAuditsDbPath, getGlobalDir } from '../paths.js';
import { initializeAuditsSchema, getAuditsDbStats } from './schema.js';
import * as audits from './audits.js';
import * as results from './results.js';
import * as issues from './issues.js';
import * as comparisons from './comparisons.js';
import type {
  HydratedAudit,
  HydratedAuditCategory,
  HydratedAuditResult,
  HydratedIssue,
  HydratedAuditComparison,
  AuditSummary,
  AuditQueryOptions,
  RuleResultQueryOptions,
  IssueQueryOptions,
  CreateAuditInput,
  InsertCategoryInput,
  InsertResultInput,
  InsertIssueInput,
  RuleResultStatus,
  IssueSeverity,
  CategoryDelta,
} from '../types.js';

/**
 * Centralized SQLite database for storing audit results
 *
 * Stored at ~/.seomator/audits.db to enable:
 * - Cross-project analytics
 * - Historical trend tracking
 * - Audit comparisons
 */
export class AuditsDatabase {
  private db: Database.Database;
  private static instance: AuditsDatabase | null = null;

  /**
   * Open or create the audits database
   */
  private constructor() {
    // Ensure global directory exists
    const globalDir = getGlobalDir();
    if (!fs.existsSync(globalDir)) {
      fs.mkdirSync(globalDir, { recursive: true });
    }

    // Open database
    const dbPath = getAuditsDbPath();
    this.db = new Database(dbPath);

    // Initialize schema
    initializeAuditsSchema(this.db);
  }

  /**
   * Get the singleton instance
   */
  static getInstance(): AuditsDatabase {
    if (!AuditsDatabase.instance) {
      AuditsDatabase.instance = new AuditsDatabase();
    }
    return AuditsDatabase.instance;
  }

  /**
   * Close the singleton instance
   */
  static closeInstance(): void {
    if (AuditsDatabase.instance) {
      AuditsDatabase.instance.close();
      AuditsDatabase.instance = null;
    }
  }

  /**
   * Get the underlying database instance (for advanced operations)
   */
  getDb(): Database.Database {
    return this.db;
  }

  /**
   * Close the database connection
   */
  close(): void {
    this.db.close();
  }

  /**
   * Get database statistics
   */
  getStats(): {
    audits: number;
    categories: number;
    results: number;
    issues: number;
    comparisons: number;
    dbSizeBytes: number;
  } {
    return getAuditsDbStats(this.db);
  }

  // ===========================================================================
  // Audit Operations
  // ===========================================================================

  /**
   * Create a new audit
   */
  createAudit(input: CreateAuditInput): HydratedAudit {
    return audits.createAudit(this.db, input);
  }

  /**
   * Get an audit by its ID (e.g., "2024-01-23-abc123")
   */
  getAudit(auditId: string): HydratedAudit | null {
    return audits.getAudit(this.db, auditId);
  }

  /**
   * Get an audit by database ID
   */
  getAuditById(id: number): HydratedAudit | null {
    return audits.getAuditById(this.db, id);
  }

  /**
   * Get the most recent audit for a domain
   */
  getLatestAudit(domain: string): HydratedAudit | null {
    return audits.getLatestAudit(this.db, domain);
  }

  /**
   * Get the previous audit for comparison
   */
  getPreviousAudit(domain: string, beforeAuditId: string): HydratedAudit | null {
    return audits.getPreviousAudit(this.db, domain, beforeAuditId);
  }

  /**
   * List audits with optional filtering
   */
  listAudits(options?: AuditQueryOptions): AuditSummary[] {
    return audits.listAudits(this.db, options);
  }

  /**
   * Complete an audit with final results
   */
  completeAudit(
    auditId: string,
    stats: {
      overallScore: number;
      totalRules: number;
      passedCount: number;
      warningCount: number;
      failedCount: number;
      pagesAudited: number;
    }
  ): HydratedAudit | null {
    return audits.completeAudit(this.db, auditId, stats);
  }

  /**
   * Fail an audit
   */
  failAudit(auditId: string): HydratedAudit | null {
    return audits.failAudit(this.db, auditId);
  }

  /**
   * Delete an audit and all associated data
   */
  deleteAudit(auditId: string): boolean {
    return audits.deleteAudit(this.db, auditId);
  }

  /**
   * Get audit count
   */
  getAuditCount(domain?: string): number {
    return audits.getAuditCount(this.db, domain);
  }

  /**
   * Get unique domains with audits
   */
  getAuditedDomains(): string[] {
    return audits.getAuditedDomains(this.db);
  }

  // ===========================================================================
  // Category Operations
  // ===========================================================================

  /**
   * Insert category results
   */
  insertCategories(auditId: number, categories: InsertCategoryInput[]): number {
    return results.insertCategories(this.db, auditId, categories);
  }

  /**
   * Get category results for an audit
   */
  getCategories(auditId: number): HydratedAuditCategory[] {
    return results.getCategories(this.db, auditId);
  }

  /**
   * Get a specific category result
   */
  getCategory(auditId: number, categoryId: string): HydratedAuditCategory | null {
    return results.getCategory(this.db, auditId, categoryId);
  }

  // ===========================================================================
  // Result Operations
  // ===========================================================================

  /**
   * Insert rule results
   */
  insertResults(auditId: number, resultInputs: InsertResultInput[]): number {
    return results.insertResults(this.db, auditId, resultInputs);
  }

  /**
   * Get results with filtering
   */
  getResults(auditId: number, options?: RuleResultQueryOptions): HydratedAuditResult[] {
    return results.getResults(this.db, auditId, options);
  }

  /**
   * Get results by rule
   */
  getResultsByRule(auditId: number, ruleId: string): HydratedAuditResult[] {
    return results.getResultsByRule(this.db, auditId, ruleId);
  }

  /**
   * Get results by status
   */
  getResultsByStatus(auditId: number, status: RuleResultStatus): HydratedAuditResult[] {
    return results.getResultsByStatus(this.db, auditId, status);
  }

  /**
   * Get results for a page
   */
  getResultsByPage(auditId: number, pageUrl: string): HydratedAuditResult[] {
    return results.getResultsByPage(this.db, auditId, pageUrl);
  }

  /**
   * Get failed results
   */
  getFailedResults(auditId: number): HydratedAuditResult[] {
    return results.getFailedResults(this.db, auditId);
  }

  /**
   * Get result counts
   */
  getResultCounts(auditId: number): { pass: number; warn: number; fail: number; total: number } {
    return results.getResultCounts(this.db, auditId);
  }

  /**
   * Get failed rules
   */
  getFailedRules(auditId: number): Array<{ ruleId: string; ruleName: string; failCount: number }> {
    return results.getFailedRules(this.db, auditId);
  }

  // ===========================================================================
  // Issue Operations
  // ===========================================================================

  /**
   * Insert issues
   */
  insertIssues(auditId: number, issueInputs: InsertIssueInput[]): number {
    return issues.insertIssues(this.db, auditId, issueInputs);
  }

  /**
   * Get issues with filtering
   */
  getIssues(auditId: number, options?: IssueQueryOptions): HydratedIssue[] {
    return issues.getIssues(this.db, auditId, options);
  }

  /**
   * Get issues by severity
   */
  getIssuesBySeverity(auditId: number, severity: IssueSeverity): HydratedIssue[] {
    return issues.getIssuesBySeverity(this.db, auditId, severity);
  }

  /**
   * Get critical issues
   */
  getCriticalIssues(auditId: number): HydratedIssue[] {
    return issues.getCriticalIssues(this.db, auditId);
  }

  /**
   * Get top priority issues
   */
  getTopPriorityIssues(auditId: number, limit?: number): HydratedIssue[] {
    return issues.getTopPriorityIssues(this.db, auditId, limit);
  }

  /**
   * Get issue counts
   */
  getIssueCounts(auditId: number): { critical: number; warning: number; info: number; total: number } {
    return issues.getIssueCounts(this.db, auditId);
  }

  /**
   * Generate issues from results
   */
  generateIssuesFromResults(auditId: number): number {
    return issues.generateIssuesFromResults(this.db, auditId);
  }

  // ===========================================================================
  // Comparison Operations
  // ===========================================================================

  /**
   * Compare two audits
   */
  compareAudits(currentAuditId: number, previousAuditId: number): HydratedAuditComparison | null {
    return comparisons.compareAudits(this.db, currentAuditId, previousAuditId);
  }

  /**
   * Get comparison for an audit
   */
  getComparison(currentAuditId: number): HydratedAuditComparison | null {
    return comparisons.getComparison(this.db, currentAuditId);
  }

  /**
   * Get comparisons for a domain
   */
  getComparisonsByDomain(domain: string, limit?: number): HydratedAuditComparison[] {
    return comparisons.getComparisonsByDomain(this.db, domain, limit);
  }

  /**
   * Get score trend for a domain
   */
  getScoreTrend(domain: string, limit?: number): Array<{ auditId: string; score: number; date: Date }> {
    return comparisons.getScoreTrend(this.db, domain, limit);
  }
}

/**
 * Get the audits database singleton
 */
export function getAuditsDatabase(): AuditsDatabase {
  return AuditsDatabase.getInstance();
}

/**
 * Close the audits database singleton
 */
export function closeAuditsDatabase(): void {
  AuditsDatabase.closeInstance();
}

// Re-export types
export type {
  HydratedAudit,
  HydratedAuditCategory,
  HydratedAuditResult,
  HydratedIssue,
  HydratedAuditComparison,
  AuditSummary,
  AuditQueryOptions,
  RuleResultQueryOptions,
  IssueQueryOptions,
  CreateAuditInput,
  InsertCategoryInput,
  InsertResultInput,
  InsertIssueInput,
  RuleResultStatus,
  IssueSeverity,
  CategoryDelta,
};
