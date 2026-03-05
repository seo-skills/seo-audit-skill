/**
 * Database Bridge — exposes AuditsDatabase queries over IPC.
 *
 * Uses the invoke/handle pattern for request-response queries.
 * The AuditsDatabase is a singleton that stores data in ~/.seomator/audits.db.
 */

import { ipcMain } from 'electron';
import { AuditsDatabase } from '@core/storage/audits-db/index.js';
import {
  IPC_CHANNELS,
  type DbListAuditsArgs,
  type DbScoreTrendArgs,
  type AuditSummaryIpc,
  type ScoreTrendPoint,
  type AuditDetailIpc,
  type RuleMetadataIpc,
} from '../shared/ipc-types.js';
import { getRuleById } from '@core/rules/registry.js';
import type { AuditResult, CategoryResult, RuleResult } from '@core/types.js';

export function registerDbHandlers(): void {
  ipcMain.handle(
    IPC_CHANNELS.DB_LIST_AUDITS,
    (_event, args?: DbListAuditsArgs): AuditSummaryIpc[] => {
      const db = AuditsDatabase.getInstance();
      const summaries = db.listAudits({
        domain: args?.domain,
        limit: args?.limit ?? 50,
        offset: args?.offset ?? 0,
      });

      // Serialize Date objects for IPC transport
      return summaries.map((s) => ({
        id: s.id,
        auditId: s.auditId,
        domain: s.domain,
        projectName: s.projectName,
        startUrl: s.startUrl,
        overallScore: s.overallScore,
        pagesAudited: s.pagesAudited,
        passedCount: s.passedCount,
        warningCount: s.warningCount,
        failedCount: s.failedCount,
        startedAt: s.startedAt instanceof Date ? s.startedAt.toISOString() : String(s.startedAt),
        completedAt: s.completedAt instanceof Date ? s.completedAt.toISOString() : s.completedAt ? String(s.completedAt) : null,
        status: s.status,
      }));
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.DB_GET_SCORE_TREND,
    (_event, args: DbScoreTrendArgs): ScoreTrendPoint[] => {
      const db = AuditsDatabase.getInstance();
      const trend = db.getScoreTrend(args.domain, args.limit);

      return trend.map((t) => ({
        auditId: t.auditId,
        score: t.score,
        date: t.date instanceof Date ? t.date.toISOString() : String(t.date),
      }));
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.DB_GET_AUDITED_DOMAINS,
    (): string[] => {
      const db = AuditsDatabase.getInstance();
      return db.getAuditedDomains();
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.DB_GET_AUDIT_DETAIL,
    (_event, auditId: string): AuditDetailIpc | null => {
      const db = AuditsDatabase.getInstance();
      const audit = db.getAudit(auditId);
      if (!audit) return null;

      // Fetch stored categories and results
      const dbCategories = db.getCategories(audit.id);
      const dbResults = db.getResults(audit.id);

      // Group results by categoryId
      const resultsByCategory = new Map<string, RuleResult[]>();
      for (const r of dbResults) {
        const list = resultsByCategory.get(r.categoryId) ?? [];
        list.push({
          ruleId: r.ruleId,
          status: r.status as RuleResult['status'],
          message: r.message,
          score: r.score,
          details: (r.details as Record<string, unknown>) ?? undefined,
        });
        resultsByCategory.set(r.categoryId, list);
      }

      // Reconstruct CategoryResult[] in the same order as stored categories
      const categoryResults: CategoryResult[] = dbCategories.map((cat) => ({
        categoryId: cat.categoryId,
        score: cat.score,
        passCount: cat.passCount,
        warnCount: cat.warnCount,
        failCount: cat.failCount,
        results: resultsByCategory.get(cat.categoryId) ?? [],
      }));

      const result: AuditResult = {
        url: audit.startUrl,
        overallScore: audit.overallScore,
        categoryResults,
        timestamp: audit.startedAt instanceof Date
          ? audit.startedAt.toISOString()
          : String(audit.startedAt),
        crawledPages: audit.pagesAudited,
      };

      // Build rule metadata from results + registry
      const ruleMetadata: Record<string, RuleMetadataIpc> = {};
      for (const r of dbResults) {
        if (!ruleMetadata[r.ruleId]) {
          const rule = getRuleById(r.ruleId);
          ruleMetadata[r.ruleId] = {
            name: rule?.name ?? r.ruleName,
            description: rule?.description ?? '',
          };
        }
      }

      return { result, ruleMetadata };
    },
  );
}
