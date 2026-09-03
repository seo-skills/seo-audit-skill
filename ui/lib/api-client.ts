/**
 * Which host is this?
 *
 * Under Electron the preload script put `electronAPI` on the window. Served by
 * `seomator serve`, it is not there and the HTTP adapter takes over. Every
 * component asks this rather than either transport directly.
 */

import { getAPI as getElectronAPI } from './ipc-client.js';
import { httpApi, httpRuns, subscribeToRun } from './http-api.js';
import type { AppInfoIpc, AuditDetail, AuditRunArgs, AuditSummaryDto, DbListAuditsArgs, DbScoreTrendArgs, DomainSummary, RunState, ScoreTrendPointDto, StoredComparison } from '../../electron/shared/ipc-types.js';

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

/** Starting and watching a run, in whichever transport this host provides */
export interface DashboardRuns {
  start(args: AuditRunArgs): Promise<void>;
  cancel(): Promise<void>;
  getState(): Promise<RunState | null>;
  /** Called with every state change; returns unsubscribe */
  subscribe(onState: (state: RunState) => void): () => void;
  /** Store a finished run whose first save failed */
  retrySave(runId: string): Promise<{ auditId: string }>;
  /** Where to download an unsaved run, or null when the host cannot */
  exportUrl(runId: string, format: string): string | null;
}

export function getRuns(): DashboardRuns {
  const electron = getElectronAPI();
  if (electron === null) {
    return {
      start: async (args) => {
        await httpRuns.start(args);
      },
      cancel: () => httpRuns.cancel(),
      getState: () => httpRuns.getState(),
      subscribe: (onState) => subscribeToRun(onState),
      retrySave: (runId) => httpRuns.retrySave(runId),
      exportUrl: (runId, format) => httpRuns.exportUrl(runId, format),
    };
  }

  return {
    start: async (args) => {
      const outcome = await electron.runAudit(args);
      if (!outcome.started && outcome.error) throw new Error(outcome.error.message);
    },
    cancel: async () => {
      await electron.cancelAudit();
    },
    getState: () => electron.getAuditState(),
    subscribe: (onState) => electron.onAuditState(onState),
    // The desktop app saves through its own bridge, and has no unsaved-run
    // export: it writes the file with a save dialog instead.
    retrySave: () => Promise.reject(new Error('Retry save is not available in the desktop app yet.')),
    exportUrl: () => null,
  };
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
