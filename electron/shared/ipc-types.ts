/**
 * Typed IPC channel contract between main and renderer processes.
 *
 * Channels follow a namespace:action pattern:
 * - audit:*  — audit lifecycle events
 * - db:*     — database queries (invoke/handle pattern)
 */

import type { AuditResult, CategoryResult, RuleResult } from '../../src/types.js';

// ─── Audit Runner Channels ──────────────────────────────────────────────────

export interface AuditRunArgs {
  url: string;
  options: {
    measureCwv?: boolean;
    crawl?: boolean;
    maxPages?: number;
    concurrency?: number;
    categories?: string[];
  };
}

export interface AuditProgressCategoryStart {
  categoryId: string;
  categoryName: string;
}

export interface AuditProgressCategoryComplete {
  categoryId: string;
  categoryName: string;
  result: CategoryResult;
}

export interface AuditProgressRuleComplete {
  ruleId: string;
  ruleName: string;
  result: RuleResult;
}

export interface AuditProgressPageComplete {
  url: string;
  pageNumber: number;
  totalPages: number;
}

// ─── Audit Complete Payload ─────────────────────────────────────────────────

/** Rule name + description looked up from the registry in the main process */
export interface RuleMetadataIpc {
  name: string;
  description: string;
}

/** Sent with audit:complete — includes rule metadata for the renderer */
export interface AuditCompletePayload {
  result: AuditResult;
  ruleMetadata: Record<string, RuleMetadataIpc>;
}

// ─── Database Query Types ───────────────────────────────────────────────────

export interface DbListAuditsArgs {
  domain?: string;
  limit?: number;
  offset?: number;
}

export interface DbScoreTrendArgs {
  domain: string;
  limit?: number;
}

export interface AuditSummaryIpc {
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
  startedAt: string;
  completedAt: string | null;
  status: string;
}

export interface ScoreTrendPoint {
  auditId: string;
  score: number;
  date: string;
}

// ─── Audit Detail (historical) ──────────────────────────────────────────────

/** Full audit detail reconstructed from the database for historical viewing */
export interface AuditDetailIpc {
  result: AuditResult;
  ruleMetadata: Record<string, RuleMetadataIpc>;
}

// ─── Channel Map ────────────────────────────────────────────────────────────

export const IPC_CHANNELS = {
  // Renderer -> Main (one-way sends)
  AUDIT_RUN: 'audit:run',
  AUDIT_CANCEL: 'audit:cancel',

  // Main -> Renderer (streaming events)
  AUDIT_CATEGORY_START: 'audit:progress:category-start',
  AUDIT_CATEGORY_COMPLETE: 'audit:progress:category-complete',
  AUDIT_RULE_COMPLETE: 'audit:progress:rule-complete',
  AUDIT_PAGE_COMPLETE: 'audit:progress:page-complete',
  AUDIT_COMPLETE: 'audit:complete',
  AUDIT_ERROR: 'audit:error',

  // Renderer <-> Main (invoke/handle)
  DB_LIST_AUDITS: 'db:list-audits',
  DB_GET_SCORE_TREND: 'db:get-score-trend',
  DB_GET_AUDITED_DOMAINS: 'db:get-audited-domains',
  DB_GET_AUDIT_DETAIL: 'db:get-audit-detail',
} as const;
