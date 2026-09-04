/**
 * Preload Script — secure bridge between main and renderer processes.
 *
 * Uses contextBridge to expose a typed `electronAPI` on the window object.
 * The renderer never gets direct access to Node.js or Electron APIs.
 */

import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '../shared/ipc-types.js';
import type {
  AuditRunArgs,
  AuditStartResult,
  AuditCompletePayload,
  AuditDetail,
  AuditSummaryDto,
  AppInfoIpc,
  DbListAuditsArgs,
  DbScoreTrendArgs,
  DomainSummary,
  RunError,
  RunState,
  ScoreTrendPointDto,
  StoredComparison,
} from '../shared/ipc-types.js';

export interface ElectronAPI {
  // Audit actions
  runAudit: (args: AuditRunArgs) => Promise<AuditStartResult>;
  cancelAudit: () => Promise<boolean>;
  /** The run state as it stands now, for a window that opened mid-run */
  getAuditState: () => Promise<RunState>;

  // Audit event listeners (returns unsubscribe function)
  /** Fires on every change with the whole run state */
  onAuditState: (cb: (state: RunState) => void) => () => void;
  onAuditComplete: (cb: (payload: AuditCompletePayload) => void) => () => void;
  onAuditError: (cb: (error: RunError) => void) => () => void;

  // Database queries
  listAudits: (args?: DbListAuditsArgs) => Promise<AuditSummaryDto[]>;
  getScoreTrend: (args: DbScoreTrendArgs) => Promise<ScoreTrendPointDto[]>;
  getAuditedDomains: () => Promise<string[]>;
  listDomains: () => Promise<DomainSummary[]>;
  getAuditDetail: (auditId: string) => Promise<AuditDetail | null>;
  compare: (auditId: string, against?: string) => Promise<StoredComparison>;
  deleteAudit: (auditId: string) => Promise<void>;
  /** Opens a save dialog; resolves with the written path, or null if cancelled */
  exportAudit: (auditId: string, format: 'html' | 'markdown' | 'json' | 'llm') => Promise<string | null>;

  // Build facts
  getAppInfo: () => Promise<AppInfoIpc>;
}

function createEventSubscriber<T>(channel: string) {
  return (callback: (data: T) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: T) => callback(data);
    ipcRenderer.on(channel, handler);
    return () => {
      ipcRenderer.removeListener(channel, handler);
    };
  };
}

const electronAPI: ElectronAPI = {
  // Audit actions
  runAudit: (args) => ipcRenderer.invoke(IPC_CHANNELS.AUDIT_RUN, args),
  cancelAudit: () => ipcRenderer.invoke(IPC_CHANNELS.AUDIT_CANCEL),
  getAuditState: () => ipcRenderer.invoke(IPC_CHANNELS.AUDIT_GET_STATE),

  // Audit event subscriptions
  onAuditState: createEventSubscriber(IPC_CHANNELS.AUDIT_STATE),
  onAuditComplete: createEventSubscriber(IPC_CHANNELS.AUDIT_COMPLETE),
  onAuditError: createEventSubscriber(IPC_CHANNELS.AUDIT_ERROR),

  // Database queries
  listAudits: (args) => ipcRenderer.invoke(IPC_CHANNELS.DB_LIST_AUDITS, args),
  getScoreTrend: (args) => ipcRenderer.invoke(IPC_CHANNELS.DB_GET_SCORE_TREND, args),
  getAuditedDomains: () => ipcRenderer.invoke(IPC_CHANNELS.DB_GET_AUDITED_DOMAINS),
  listDomains: () => ipcRenderer.invoke(IPC_CHANNELS.DB_LIST_DOMAINS),
  getAuditDetail: (auditId) => ipcRenderer.invoke(IPC_CHANNELS.DB_GET_AUDIT_DETAIL, auditId),
  compare: (auditId, against) => ipcRenderer.invoke(IPC_CHANNELS.DB_COMPARE, auditId, against),
  deleteAudit: (auditId) => ipcRenderer.invoke(IPC_CHANNELS.DB_DELETE_AUDIT, auditId),
  exportAudit: (auditId, format) => ipcRenderer.invoke(IPC_CHANNELS.DB_EXPORT_AUDIT, auditId, format),

  // Build facts
  getAppInfo: () => ipcRenderer.invoke(IPC_CHANNELS.APP_GET_INFO),
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
