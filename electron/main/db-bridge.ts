/**
 * Database Bridge — exposes the stored-audit queries over IPC.
 *
 * The queries themselves live in `src/dashboard/queries.ts`, shared with the
 * web dashboard, so both surfaces show the same audit the same way. This file
 * is the transport.
 */

import { ipcMain } from 'electron';
import { AuditsDatabase } from '@core/storage/audits-db/index.js';
import { getAuditsDbPath } from '@core/storage/paths.js';
import {
  getAuditDetail,
  getTrend,
  listAudits,
  listDomains,
} from '@core/dashboard/queries.js';
import type { AuditDetail, AuditSummaryDto, DomainSummary, ScoreTrendPointDto } from '@core/dashboard/contract.js';
import {
  IPC_CHANNELS,
  type DbListAuditsArgs,
  type DbScoreTrendArgs,
  type AppInfoIpc,
} from '../shared/ipc-types.js';
import { getRuleCount } from '@core/rules/registry.js';
import { categories } from '@core/categories/index.js';
import { getVersion } from '@core/version.js';
import { DESKTOP_CAPABILITIES } from './audit-bridge.js';

export function registerDbHandlers(): void {
  // Counted from the registry the way the CLI banner does it, so the numbers
  // the app advertises cannot fall behind the rules it actually runs.
  ipcMain.handle(
    IPC_CHANNELS.APP_GET_INFO,
    (): AppInfoIpc => ({
      ruleCount: getRuleCount(),
      categoryCount: categories.length,
      version: getVersion(),
      capabilities: DESKTOP_CAPABILITIES,
      dataDirectory: getAuditsDbPath(),
    })
  );

  ipcMain.handle(
    IPC_CHANNELS.DB_LIST_AUDITS,
    (_event, args?: DbListAuditsArgs): AuditSummaryDto[] =>
      listAudits(AuditsDatabase.getInstance(), {
        ...(args?.domain && { domain: args.domain }),
        limit: args?.limit ?? 50,
        offset: args?.offset ?? 0,
      })
  );

  ipcMain.handle(
    IPC_CHANNELS.DB_GET_SCORE_TREND,
    (_event, args: DbScoreTrendArgs): ScoreTrendPointDto[] =>
      getTrend(AuditsDatabase.getInstance(), args.domain, args.limit)
  );

  ipcMain.handle(IPC_CHANNELS.DB_GET_AUDITED_DOMAINS, (): string[] =>
    AuditsDatabase.getInstance().getAuditedDomains()
  );

  ipcMain.handle(IPC_CHANNELS.DB_LIST_DOMAINS, (): DomainSummary[] =>
    listDomains(AuditsDatabase.getInstance())
  );

  ipcMain.handle(
    IPC_CHANNELS.DB_GET_AUDIT_DETAIL,
    (_event, auditId: string): AuditDetail | null =>
      getAuditDetail(AuditsDatabase.getInstance(), auditId)
  );
}
