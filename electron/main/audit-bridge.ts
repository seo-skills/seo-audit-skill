/**
 * Audit Bridge — connects the Auditor class to Electron IPC.
 *
 * The existing Auditor class already uses a callback interface
 * (onCategoryStart, onCategoryComplete, etc.), so we simply wire
 * those callbacks to BrowserWindow.webContents.send() calls.
 */

import { BrowserWindow, ipcMain } from 'electron';
import { Auditor } from '@core/auditor.js';
import type { AuditResult } from '@core/types.js';
import { getRuleById } from '@core/rules/registry.js';
import { IPC_CHANNELS, type AuditRunArgs, type AuditCompletePayload, type RuleMetadataIpc } from '../shared/ipc-types.js';
import { fetchPageWithBrowserWindow } from './electron-fetcher.js';

/** Build a map of ruleId -> { name, description } from the rule registry */
function buildRuleMetadata(result: AuditResult): Record<string, RuleMetadataIpc> {
  const metadata: Record<string, RuleMetadataIpc> = {};
  for (const cat of result.categoryResults) {
    for (const r of cat.results) {
      if (!metadata[r.ruleId]) {
        const rule = getRuleById(r.ruleId);
        metadata[r.ruleId] = {
          name: rule?.name ?? r.ruleId.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
          description: rule?.description ?? '',
        };
      }
    }
  }
  return metadata;
}

let currentAuditor: Auditor | null = null;
let abortController: AbortController | null = null;

export function registerAuditHandlers(getWindow: () => BrowserWindow | null): void {
  ipcMain.on(IPC_CHANNELS.AUDIT_RUN, async (_event, args: AuditRunArgs) => {
    const win = getWindow();
    if (!win) return;

    // Prevent concurrent audits
    if (currentAuditor) {
      win.webContents.send(IPC_CHANNELS.AUDIT_ERROR, 'An audit is already running');
      return;
    }

    abortController = new AbortController();

    try {
      currentAuditor = new Auditor({
        measureCwv: args.options.measureCwv ?? false,
        categories: args.options.categories ?? [],
        browserFetcher: fetchPageWithBrowserWindow,

        onCategoryStart: (categoryId, categoryName) => {
          if (!abortController?.signal.aborted) {
            win.webContents.send(IPC_CHANNELS.AUDIT_CATEGORY_START, {
              categoryId,
              categoryName,
            });
          }
        },

        onCategoryComplete: (categoryId, categoryName, result) => {
          if (!abortController?.signal.aborted) {
            win.webContents.send(IPC_CHANNELS.AUDIT_CATEGORY_COMPLETE, {
              categoryId,
              categoryName,
              result,
            });
          }
        },

        onRuleComplete: (ruleId, ruleName, result) => {
          if (!abortController?.signal.aborted) {
            win.webContents.send(IPC_CHANNELS.AUDIT_RULE_COMPLETE, {
              ruleId,
              ruleName,
              result,
            });
          }
        },

        onPageComplete: (url, pageNumber, totalPages) => {
          if (!abortController?.signal.aborted) {
            win.webContents.send(IPC_CHANNELS.AUDIT_PAGE_COMPLETE, {
              url,
              pageNumber,
              totalPages,
            });
          }
        },
      });

      let result: AuditResult;

      if (args.options.crawl) {
        result = await currentAuditor.auditWithCrawl(
          args.url,
          args.options.maxPages ?? 10,
          args.options.concurrency ?? 3,
        );
      } else {
        result = await currentAuditor.audit(args.url);
      }

      if (!abortController?.signal.aborted) {
        const payload: AuditCompletePayload = {
          result,
          ruleMetadata: buildRuleMetadata(result),
        };
        win.webContents.send(IPC_CHANNELS.AUDIT_COMPLETE, payload);
      }
    } catch (error) {
      if (!abortController?.signal.aborted) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        win.webContents.send(IPC_CHANNELS.AUDIT_ERROR, message);
      }
    } finally {
      currentAuditor = null;
      abortController = null;
    }
  });

  ipcMain.on(IPC_CHANNELS.AUDIT_CANCEL, () => {
    if (abortController) {
      abortController.abort();
      currentAuditor = null;
      abortController = null;
    }
  });
}
