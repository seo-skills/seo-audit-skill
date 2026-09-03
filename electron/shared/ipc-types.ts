/**
 * Typed IPC channel contract between main and renderer processes.
 *
 * The shapes themselves come from `src/dashboard/contract.ts` and the shared
 * run controller, so the desktop app and the web dashboard show stored audits
 * through the same types. Only the channel names are Electron's own.
 *
 * Channels follow a namespace:action pattern:
 * - audit:*  — audit lifecycle events
 * - db:*     — database queries (invoke/handle pattern)
 */

import type { AuditQueryOptions } from '../../src/storage/types.js';

export type {
  AuditSummaryDto,
  AuditMetaDto,
  AuditDetail,
  DomainSummary,
  RuleMetadata,
  RuleSummary,
  ScoreTrendPointDto,
  StoredComparison,
} from '../../src/dashboard/contract.js';

export type {
  AuditRunArgs,
  Capabilities,
  CategoryProgress,
  RunError,
  RunPhase,
  RunState,
  RunStatus,
} from '../../src/dashboard/audit-session.js';

import type { AuditResult } from '../../src/types.js';
import type { RuleMetadata } from '../../src/dashboard/contract.js';
import type { Capabilities, RunError } from '../../src/dashboard/audit-session.js';

// ─── Audit Runner ───────────────────────────────────────────────────────────

/** Sent with audit:complete once the run has finished and been stored */
export interface AuditCompletePayload {
  result: AuditResult;
  ruleMetadata: Record<string, RuleMetadata>;
  /** The stored audit's id, or null when it was not stored */
  auditId: string | null;
  /** Why the finished audit could not be stored, when that happened */
  saveError?: string;
}

// ─── Database Query Types ───────────────────────────────────────────────────

export type DbListAuditsArgs = Pick<AuditQueryOptions, 'domain' | 'limit' | 'offset'>;

export interface DbScoreTrendArgs {
  domain: string;
  limit?: number;
}

/**
 * Facts about the running build that the renderer would otherwise hardcode.
 *
 * The rule registry lives only in the main process, so the renderer cannot
 * count rules itself. It used to print a literal instead, which drifted 81
 * rules behind the engine between releases.
 */
export interface AppInfoIpc {
  /** Rules registered in this build */
  ruleCount: number;
  /** Categories those rules are grouped into */
  categoryCount: number;
  /** Package version */
  version: string;
  /**
   * What this build can actually do. The desktop app renders pages in a
   * BrowserWindow rather than Playwright, which cannot emulate a mobile
   * viewport or drive a synthetic interaction, so the UI hides those options
   * instead of offering settings that would silently do nothing.
   */
  capabilities: Capabilities;
  /** Where audits are stored, for the settings and error messages */
  dataDirectory: string;
}

/** What `audit:run` answers with, so the renderer learns why a start failed */
export interface AuditStartResult {
  started: boolean;
  error?: RunError;
}

// ─── Channel Map ────────────────────────────────────────────────────────────

export const IPC_CHANNELS = {
  // Renderer <-> Main (invoke/handle)
  AUDIT_RUN: 'audit:run',
  AUDIT_CANCEL: 'audit:cancel',
  AUDIT_GET_STATE: 'audit:get-state',

  // Main -> Renderer (streaming events)
  /** The whole run state on every change; replaces the per-event channels */
  AUDIT_STATE: 'audit:state',
  AUDIT_COMPLETE: 'audit:complete',
  AUDIT_ERROR: 'audit:error',

  // Renderer <-> Main (invoke/handle)
  DB_LIST_AUDITS: 'db:list-audits',
  DB_GET_SCORE_TREND: 'db:get-score-trend',
  DB_GET_AUDITED_DOMAINS: 'db:get-audited-domains',
  DB_GET_AUDIT_DETAIL: 'db:get-audit-detail',
  DB_LIST_DOMAINS: 'db:list-domains',
  APP_GET_INFO: 'app:get-info',
} as const;
