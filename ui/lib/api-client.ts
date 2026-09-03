/**
 * Which host is this?
 *
 * Under Electron the preload script put `electronAPI` on the window. Served by
 * `seomator serve`, it is not there and the HTTP adapter takes over. Every
 * component asks this rather than either transport directly.
 */

import { getAPI as getElectronAPI } from './ipc-client.js';
import { httpApi } from './http-api.js';
import type { AppInfoIpc, AuditDetail, AuditSummaryDto, DbListAuditsArgs, DbScoreTrendArgs, DomainSummary, ScoreTrendPointDto, StoredComparison } from '../../electron/shared/ipc-types.js';

export type Host = 'electron' | 'web';

/** Which shell the UI is running in */
export function getHost(): Host {
  return getElectronAPI() !== null ? 'electron' : 'web';
}

/**
 * The reads every screen needs, in whichever transport this host provides.
 *
 * Compare and delete are HTTP-only for now: the Electron app reaches them
 * through its own bridge in a later task, and the pages that use them are
 * guarded on `getHost()`.
 */
export interface DashboardReads {
  listAudits(args?: DbListAuditsArgs): Promise<AuditSummaryDto[]>;
  getAuditDetail(auditId: string): Promise<AuditDetail | null>;
  getScoreTrend(args: DbScoreTrendArgs): Promise<ScoreTrendPointDto[]>;
  listDomains(): Promise<DomainSummary[]>;
  getAppInfo(): Promise<AppInfoIpc>;
  compare(auditId: string, against?: string): Promise<StoredComparison>;
  deleteAudit(auditId: string): Promise<void>;
  exportUrl(auditId: string, format: 'html' | 'markdown' | 'json' | 'llm'): string;
}

export function getReads(): DashboardReads {
  const electron = getElectronAPI();
  if (electron === null) return httpApi;

  return {
    listAudits: (args) => electron.listAudits(args),
    getAuditDetail: (auditId) => electron.getAuditDetail(auditId),
    getScoreTrend: (args) => electron.getScoreTrend(args),
    listDomains: () => electron.listDomains(),
    getAppInfo: () => electron.getAppInfo(),
    compare: (auditId, against) => electron.compare(auditId, against),
    deleteAudit: (auditId) => electron.deleteAudit(auditId),
    exportUrl: (auditId, format) => `/api/audits/${auditId}/export?format=${format}`,
  };
}
