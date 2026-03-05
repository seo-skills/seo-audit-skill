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
  AuditProgressCategoryStart,
  AuditProgressCategoryComplete,
  AuditProgressRuleComplete,
  AuditProgressPageComplete,
  AuditCompletePayload,
  DbListAuditsArgs,
  DbScoreTrendArgs,
  AuditSummaryIpc,
  ScoreTrendPoint,
  AuditDetailIpc,
} from '../shared/ipc-types.js';

export interface ElectronAPI {
  // Audit actions
  runAudit: (args: AuditRunArgs) => void;
  cancelAudit: () => void;

  // Audit event listeners (returns unsubscribe function)
  onCategoryStart: (cb: (data: AuditProgressCategoryStart) => void) => () => void;
  onCategoryComplete: (cb: (data: AuditProgressCategoryComplete) => void) => () => void;
  onRuleComplete: (cb: (data: AuditProgressRuleComplete) => void) => () => void;
  onPageComplete: (cb: (data: AuditProgressPageComplete) => void) => () => void;
  onAuditComplete: (cb: (payload: AuditCompletePayload) => void) => () => void;
  onAuditError: (cb: (message: string) => void) => () => void;

  // Database queries
  listAudits: (args?: DbListAuditsArgs) => Promise<AuditSummaryIpc[]>;
  getScoreTrend: (args: DbScoreTrendArgs) => Promise<ScoreTrendPoint[]>;
  getAuditedDomains: () => Promise<string[]>;
  getAuditDetail: (auditId: string) => Promise<AuditDetailIpc | null>;
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
  runAudit: (args) => ipcRenderer.send(IPC_CHANNELS.AUDIT_RUN, args),
  cancelAudit: () => ipcRenderer.send(IPC_CHANNELS.AUDIT_CANCEL),

  // Audit event subscriptions
  onCategoryStart: createEventSubscriber(IPC_CHANNELS.AUDIT_CATEGORY_START),
  onCategoryComplete: createEventSubscriber(IPC_CHANNELS.AUDIT_CATEGORY_COMPLETE),
  onRuleComplete: createEventSubscriber(IPC_CHANNELS.AUDIT_RULE_COMPLETE),
  onPageComplete: createEventSubscriber(IPC_CHANNELS.AUDIT_PAGE_COMPLETE),
  onAuditComplete: createEventSubscriber(IPC_CHANNELS.AUDIT_COMPLETE),
  onAuditError: createEventSubscriber(IPC_CHANNELS.AUDIT_ERROR),

  // Database queries
  listAudits: (args) => ipcRenderer.invoke(IPC_CHANNELS.DB_LIST_AUDITS, args),
  getScoreTrend: (args) => ipcRenderer.invoke(IPC_CHANNELS.DB_GET_SCORE_TREND, args),
  getAuditedDomains: () => ipcRenderer.invoke(IPC_CHANNELS.DB_GET_AUDITED_DOMAINS),
  getAuditDetail: (auditId) => ipcRenderer.invoke(IPC_CHANNELS.DB_GET_AUDIT_DETAIL, auditId),
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
