/**
 * Zustand store for the current audit session.
 *
 * The main process owns the run through the shared AuditSession and streams
 * its whole state on every change, so this store mirrors that state rather
 * than accumulating events. That is what keeps a crawl's category list at one
 * row per category: it used to append one entry per category per page, so a
 * 50-page crawl rendered 1,000 rows and a progress bar past 100%.
 */

import { create } from 'zustand';
import type { AuditResult } from '../../src/types.js';
import type { RunError, RunState, RuleMetadata } from '../../electron/shared/ipc-types.js';

export type AuditStatus = RunState['status'];

/** The run state before anything has been started */
export const IDLE_RUN_STATE: RunState = {
  status: 'idle',
  runId: null,
  url: null,
  args: null,
  phase: 'starting',
  startedAt: null,
  finishedAt: null,
  crawl: null,
  pages: { completed: 0, total: 0, currentUrl: null },
  firstPageAt: null,
  lastPageAt: null,
  categories: [],
  recentRules: [],
  auditId: null,
  error: null,
};

interface AuditState {
  /** Mirrors the main process's run state */
  run: RunState;
  result: AuditResult | null;
  ruleMetadata: Record<string, RuleMetadata>;
  /** Set when a finished audit could not be stored */
  saveError: string | null;

  // Actions
  setRunState: (state: RunState) => void;
  setSaveError: (saveError: string | null) => void;
  setComplete: (
    result: AuditResult,
    ruleMetadata: Record<string, RuleMetadata>,
    saveError?: string
  ) => void;
  setError: (error: RunError) => void;
  loadHistorical: (url: string, result: AuditResult, ruleMetadata: Record<string, RuleMetadata>) => void;
  reset: () => void;
}

export const useAuditStore = create<AuditState>((set) => ({
  run: IDLE_RUN_STATE,
  result: null,
  ruleMetadata: {},
  saveError: null,

  setRunState: (state) =>
    set((current) =>
      // A fresh run clears the previous result so the page cannot show an old
      // score beside a running audit.
      state.status === 'running' && state.runId !== current.run.runId
        ? { run: state, result: null, saveError: null }
        : { run: state }
    ),

  setSaveError: (saveError) => set({ saveError }),

  setComplete: (result, ruleMetadata, saveError) =>
    set({ result, ruleMetadata, saveError: saveError ?? null }),

  setError: (error) => set((current) => ({ run: { ...current.run, status: 'error', error } })),

  loadHistorical: (url, result, ruleMetadata) =>
    set({
      run: { ...IDLE_RUN_STATE, status: 'complete', url, phase: 'done' },
      result,
      ruleMetadata,
      saveError: null,
    }),

  reset: () => set({ run: IDLE_RUN_STATE, result: null, ruleMetadata: {}, saveError: null }),
}));
