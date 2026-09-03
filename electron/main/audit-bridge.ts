/**
 * Audit Bridge — runs audits through the shared AuditSession and streams its
 * state to the renderer.
 *
 * The session owns the run: one at a time, bounded state, real cancellation
 * and persistence. This file is only the transport, which is why it no longer
 * tracks an auditor or an abort controller of its own.
 */

import { BrowserWindow, ipcMain } from 'electron';
import { AuditSession, type AuditRunArgs, type Capabilities } from '@core/dashboard/audit-session.js';
import { classifyError } from '@core/errors.js';
import {
  IPC_CHANNELS,
  type AuditCompletePayload,
  type AuditStartResult,
} from '../shared/ipc-types.js';
import { fetchPageWithBrowserWindow } from './electron-fetcher.js';

/**
 * What the desktop build can do.
 *
 * Pages render in a BrowserWindow rather than under Playwright: that gives
 * Core Web Vitals and a rendered DOM, but it has no mobile emulation and no
 * synthetic interaction, so those two are reported as unavailable rather than
 * offered as settings that would quietly do nothing.
 */
export const DESKTOP_CAPABILITIES: Capabilities = {
  browserRender: true,
  mobileParity: false,
  simulateInteraction: false,
  persistence: true,
};

let session: AuditSession | null = null;

/** The session for this app instance, created on first use */
export function getAuditSession(): AuditSession {
  if (!session) {
    session = new AuditSession({
      source: 'desktop',
      capabilities: DESKTOP_CAPABILITIES,
      auditorOptions: { browserFetcher: fetchPageWithBrowserWindow },
    });
  }
  return session;
}

export function registerAuditHandlers(getWindow: () => BrowserWindow | null): void {
  const auditSession = getAuditSession();

  // One subscription for the app's lifetime: every state change goes to
  // whichever window is open, so a window reopened mid-run is correct at once.
  auditSession.subscribe((state) => {
    getWindow()?.webContents.send(IPC_CHANNELS.AUDIT_STATE, state);
  });

  ipcMain.handle(IPC_CHANNELS.AUDIT_RUN, async (_event, args: AuditRunArgs): Promise<AuditStartResult> => {
    let run: ReturnType<AuditSession['start']>;
    try {
      run = auditSession.start(args);
    } catch (error) {
      // Rejected before the run began: already running, or a bad request.
      const audited = classifyError(error);
      return {
        started: false,
        error: { code: audited.code, message: audited.message, ...(audited.hint && { hint: audited.hint }) },
      };
    }

    // Deliberately not awaited: the renderer follows the run through the
    // state stream, and this handler answers as soon as the run has started.
    void run
      .then((outcome) => {
        const payload: AuditCompletePayload = {
          result: outcome.result,
          ruleMetadata: outcome.ruleMetadata,
          auditId: outcome.saved?.auditId ?? null,
          ...(outcome.saveError && { saveError: outcome.saveError }),
        };
        getWindow()?.webContents.send(IPC_CHANNELS.AUDIT_COMPLETE, payload);
      })
      .catch(() => {
        // The session has already put the failure into the state stream,
        // including whether it was a cancellation.
        const state = auditSession.getState();
        if (state.error) {
          getWindow()?.webContents.send(IPC_CHANNELS.AUDIT_ERROR, state.error);
        }
      });

    return { started: true };
  });

  ipcMain.handle(IPC_CHANNELS.AUDIT_CANCEL, (): boolean => auditSession.cancel());

  ipcMain.handle(IPC_CHANNELS.AUDIT_GET_STATE, () => auditSession.getState());
}
