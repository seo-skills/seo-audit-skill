/**
 * Database record types for SQLite storage
 *
 * Naming conventions:
 * - Db* prefix: Raw database record (matches SQLite column names)
 * - Hydrated*: Enriched record with parsed JSON fields
 * - *Options: Query/filter options for list operations
 */

import type { PartialSeomatorConfig } from '../config/schema.js';

// =============================================================================
// Project Database Types (per-domain at ~/.seomator/projects/<domain>/project.db)
// =============================================================================

/**
 * Project record - represents a single domain/website
 */
export interface DbProject {
  id: number;
  domain: string;
  name: string | null;
  created_at: string;
  updated_at: string;
  config_json: string | null;
}

/**
 * Project with parsed config
 */
export interface HydratedProject {
  id: number;
  domain: string;
  name: string | null;
  createdAt: Date;
  updatedAt: Date;
  config: PartialSeomatorConfig | null;
}

/**
 * Crawl status values
 */
export type CrawlStatus = 'running' | 'completed' | 'failed' | 'cancelled';

/**
 * Crawl record - represents a single crawl session
 */
export interface DbCrawl {
  id: number;
  crawl_id: string;
  project_id: number;
  start_url: string;
  status: CrawlStatus;
  started_at: string;
  completed_at: string | null;
  config_json: string | null;
  stats_json: string | null;
  error_message: string | null;
}

/**
 * Crawl statistics
 */
export interface CrawlStats {
  totalPages: number;
  duration: number;
  errorCount: number;
  successCount?: number;
}

/**
 * Crawl with parsed JSON fields
 */
export interface HydratedCrawl {
  id: number;
  crawlId: string;
  projectId: number;
  startUrl: string;
  status: CrawlStatus;
  startedAt: Date;
  completedAt: Date | null;
  config: PartialSeomatorConfig | null;
  stats: CrawlStats | null;
  errorMessage: string | null;
}

/**
 * Crawl summary for listing
 */
export interface CrawlSummary {
  id: number;
  crawlId: string;
  startUrl: string;
  status: CrawlStatus;
  startedAt: Date;
  completedAt: Date | null;
  totalPages: number;
  errorCount: number;
}

/**
 * Page record - stores crawled page data with optional compressed HTML
 */
export interface DbPage {
  id: number;
  crawl_id: number;
  url: string;
  url_hash: string;
  status_code: number;
  depth: number;
  content_type: string | null;
  html: Buffer | null;
  html_compressed: number;
  html_size: number | null;
  headers_json: string | null;
  load_time_ms: number | null;
  ttfb_ms: number | null;
  cwv_lcp: number | null;
  cwv_cls: number | null;
  cwv_inp: number | null;
  cwv_fcp: number | null;
  cwv_ttfb: number | null;
  error_message: string | null;
  crawled_at: string;
}

/**
 * Core Web Vitals from page
 */
export interface PageCoreWebVitals {
  lcp?: number;
  cls?: number;
  inp?: number;
  fcp?: number;
  ttfb?: number;
}

/**
 * Page with parsed fields (without HTML for memory efficiency)
 */
export interface HydratedPage {
  id: number;
  crawlId: number;
  url: string;
  urlHash: string;
  statusCode: number;
  depth: number;
  contentType: string | null;
  htmlSize: number | null;
  headers: Record<string, string>;
  loadTimeMs: number | null;
  ttfbMs: number | null;
  cwv: PageCoreWebVitals;
  errorMessage: string | null;
  crawledAt: Date;
}

/**
 * Page with HTML content (for audit processing)
 */
export interface HydratedPageWithHtml extends HydratedPage {
  html: string;
}

/**
 * Link record - represents a link found on a page
 */
export interface DbLink {
  id: number;
  page_id: number;
  href: string;
  href_hash: string;
  anchor_text: string | null;
  is_internal: number;
  is_nofollow: number;
  rel_value: string | null;
  target_status_code: number | null;
  target_error: string | null;
}

/**
 * Link with hydrated fields
 */
export interface HydratedLink {
  id: number;
  pageId: number;
  href: string;
  hrefHash: string;
  anchorText: string | null;
  isInternal: boolean;
  isNofollow: boolean;
  relValue: string | null;
  targetStatusCode: number | null;
  targetError: string | null;
}

/**
 * Image record - represents an image found on a page
 */
export interface DbImage {
  id: number;
  page_id: number;
  src: string;
  src_hash: string;
  alt: string | null;
  has_alt: number;
  width: string | null;
  height: string | null;
  is_lazy_loaded: number;
  loading_attr: string | null;
  srcset: string | null;
  file_size: number | null;
  format: string | null;
}

/**
 * Image with hydrated fields
 */
export interface HydratedImage {
  id: number;
  pageId: number;
  src: string;
  srcHash: string;
  alt: string | null;
  hasAlt: boolean;
  width: string | null;
  height: string | null;
  isLazyLoaded: boolean;
  loadingAttr: string | null;
  srcset: string | null;
  fileSize: number | null;
  format: string | null;
}

/**
 * Frontier status for resumable crawling
 */
export type FrontierStatus = 'pending' | 'processing' | 'completed' | 'skipped';

/**
 * Frontier record - queue item for resumable crawling
 */
export interface DbFrontier {
  id: number;
  crawl_id: number;
  url: string;
  url_hash: string;
  depth: number;
  priority: number;
  status: FrontierStatus;
  discovered_at: string;
}

// =============================================================================
// Audits Database Types (centralized at ~/.seomator/audits.db)
// =============================================================================

/**
 * Audit status values
 */
export type AuditStatus = 'running' | 'completed' | 'failed';

/**
 * Audit record - represents a complete SEO audit
 */
export interface DbAudit {
  id: number;
  audit_id: string;
  domain: string;
  project_name: string | null;
  crawl_id: string | null;
  start_url: string;
  overall_score: number;
  total_rules: number;
  passed_count: number;
  warning_count: number;
  failed_count: number;
  pages_audited: number;
  config_json: string | null;
  started_at: string;
  completed_at: string | null;
  status: AuditStatus;
}

/**
 * Audit with parsed fields
 */
export interface HydratedAudit {
  id: number;
  auditId: string;
  domain: string;
  projectName: string | null;
  crawlId: string | null;
  startUrl: string;
  overallScore: number;
  totalRules: number;
  passedCount: number;
  warningCount: number;
  failedCount: number;
  pagesAudited: number;
  config: PartialSeomatorConfig | null;
  startedAt: Date;
  completedAt: Date | null;
  status: AuditStatus;
}

/**
 * Audit summary for listing
 */
export interface AuditSummary {
  id: number;
  auditId: string;
  domain: string;
  projectName: string | null;
  startUrl: string;
  overallScore: number;
  pagesAudited: number;
  passedCount: number;
  warningCount: number;
  failedCount: number;
  startedAt: Date;
  completedAt: Date | null;
  status: AuditStatus;
}

/**
 * Category result record
 */
export interface DbAuditCategory {
  id: number;
  audit_id: number;
  category_id: string;
  category_name: string;
  score: number;
  weight: number;
  pass_count: number;
  warn_count: number;
  fail_count: number;
}

/**
 * Category result with hydrated fields
 */
export interface HydratedAuditCategory {
  id: number;
  auditId: number;
  categoryId: string;
  categoryName: string;
  score: number;
  weight: number;
  passCount: number;
  warnCount: number;
  failCount: number;
}

/**
 * Rule result status
 */
export type RuleResultStatus = 'pass' | 'warn' | 'fail';

/**
 * Per-rule, per-page audit result record
 */
export interface DbAuditResult {
  id: number;
  audit_id: number;
  category_id: string;
  rule_id: string;
  rule_name: string;
  page_url: string;
  page_url_hash: string;
  status: RuleResultStatus;
  score: number;
  message: string;
  details_json: string | null;
  executed_at: string;
}

/**
 * Audit result with parsed fields
 */
export interface HydratedAuditResult {
  id: number;
  auditId: number;
  categoryId: string;
  ruleId: string;
  ruleName: string;
  pageUrl: string;
  pageUrlHash: string;
  status: RuleResultStatus;
  score: number;
  message: string;
  details: Record<string, unknown> | null;
  executedAt: Date;
}

/**
 * Issue severity levels
 */
export type IssueSeverity = 'critical' | 'warning' | 'info';

/**
 * Aggregated issue record
 */
export interface DbIssue {
  id: number;
  audit_id: number;
  rule_id: string;
  category_id: string;
  severity: IssueSeverity;
  title: string;
  description: string | null;
  affected_pages_count: number;
  affected_pages_json: string | null;
  fix_suggestion: string | null;
  priority_score: number;
}

/**
 * Issue with parsed fields
 */
export interface HydratedIssue {
  id: number;
  auditId: number;
  ruleId: string;
  categoryId: string;
  severity: IssueSeverity;
  title: string;
  description: string | null;
  affectedPagesCount: number;
  affectedPages: string[];
  fixSuggestion: string | null;
  priorityScore: number;
}

/**
 * Audit comparison record
 */
export interface DbAuditComparison {
  id: number;
  current_audit_id: number;
  previous_audit_id: number;
  domain: string;
  score_delta: number;
  category_deltas_json: string | null;
  new_issues_count: number;
  fixed_issues_count: number;
  compared_at: string;
}

/**
 * Category score delta
 */
export interface CategoryDelta {
  categoryId: string;
  categoryName: string;
  previousScore: number;
  currentScore: number;
  delta: number;
}

/**
 * Audit comparison with parsed fields
 */
export interface HydratedAuditComparison {
  id: number;
  currentAuditId: number;
  previousAuditId: number;
  domain: string;
  scoreDelta: number;
  categoryDeltas: CategoryDelta[];
  newIssuesCount: number;
  fixedIssuesCount: number;
  comparedAt: Date;
}

// =============================================================================
// Query Options
// =============================================================================

/**
 * Pagination options
 */
export interface PaginationOptions {
  limit?: number;
  offset?: number;
}

/**
 * Crawl query options
 */
export interface CrawlQueryOptions extends PaginationOptions {
  status?: CrawlStatus;
  since?: Date;
  until?: Date;
}

/**
 * Page query options
 */
export interface PageQueryOptions extends PaginationOptions {
  statusCode?: number;
  minStatusCode?: number;
  maxStatusCode?: number;
  hasError?: boolean;
}

/**
 * Audit query options
 */
export interface AuditQueryOptions extends PaginationOptions {
  domain?: string;
  projectName?: string;
  minScore?: number;
  maxScore?: number;
  since?: Date;
  until?: Date;
  status?: AuditStatus;
}

/**
 * Rule result query options
 */
export interface RuleResultQueryOptions extends PaginationOptions {
  categoryId?: string;
  ruleId?: string;
  status?: RuleResultStatus;
  pageUrl?: string;
}

/**
 * Issue query options
 */
export interface IssueQueryOptions extends PaginationOptions {
  severity?: IssueSeverity;
  categoryId?: string;
  ruleId?: string;
  minPriority?: number;
}

// =============================================================================
// Input Types (for creating records)
// =============================================================================

/**
 * Input for creating a new crawl
 */
export interface CreateCrawlInput {
  crawlId: string;
  startUrl: string;
  config?: PartialSeomatorConfig;
}

/**
 * Input for inserting a page
 */
export interface InsertPageInput {
  url: string;
  statusCode: number;
  depth: number;
  contentType?: string;
  html?: string;
  headers?: Record<string, string>;
  loadTimeMs?: number;
  ttfbMs?: number;
  cwv?: PageCoreWebVitals;
  errorMessage?: string;
}

/**
 * Input for inserting a link
 */
export interface InsertLinkInput {
  href: string;
  anchorText?: string;
  isInternal: boolean;
  isNofollow: boolean;
  relValue?: string;
  targetStatusCode?: number;
  targetError?: string;
}

/**
 * Input for inserting an image
 */
export interface InsertImageInput {
  src: string;
  alt?: string;
  hasAlt: boolean;
  width?: string;
  height?: string;
  isLazyLoaded: boolean;
  loadingAttr?: string;
  srcset?: string;
  fileSize?: number;
  format?: string;
}

/**
 * Input for creating an audit
 */
export interface CreateAuditInput {
  auditId: string;
  domain: string;
  projectName?: string;
  crawlId?: string;
  startUrl: string;
  config?: PartialSeomatorConfig;
}

/**
 * Input for inserting a category result
 */
export interface InsertCategoryInput {
  categoryId: string;
  categoryName: string;
  score: number;
  weight: number;
  passCount: number;
  warnCount: number;
  failCount: number;
}

/**
 * Input for inserting a rule result
 */
export interface InsertResultInput {
  categoryId: string;
  ruleId: string;
  ruleName: string;
  pageUrl: string;
  status: RuleResultStatus;
  score: number;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Input for creating an issue
 */
export interface InsertIssueInput {
  ruleId: string;
  categoryId: string;
  severity: IssueSeverity;
  title: string;
  description?: string;
  affectedPages: string[];
  fixSuggestion?: string;
}

// =============================================================================
// Migration Types
// =============================================================================

/**
 * Migration record
 */
export interface DbMigration {
  id: number;
  name: string;
  applied_at: string;
}

/**
 * Migration definition
 */
export interface Migration {
  name: string;
  up: (db: unknown) => void;
  down?: (db: unknown) => void;
}

/**
 * Migration result
 */
export interface MigrationResult {
  applied: string[];
  skipped: string[];
  errors: Array<{ name: string; error: string }>;
}
