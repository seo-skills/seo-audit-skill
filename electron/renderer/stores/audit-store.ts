/**
 * Zustand store for the current audit session.
 *
 * State machine: idle -> running -> complete | error
 * Progress events stream in from the main process via IPC.
 */

import { create } from 'zustand';
import type { AuditResult, CategoryResult } from '../../../src/types.js';
import type { RuleMetadataIpc } from '../../shared/ipc-types.js';

export type AuditStatus = 'idle' | 'running' | 'complete' | 'error';

export interface CompletedCategory {
  categoryId: string;
  categoryName: string;
  result: CategoryResult;
}

export interface AuditProgress {
  completedCategories: CompletedCategory[];
  currentCategory: string | null;
  currentCategoryName: string | null;
  completedRules: number;
  currentPage: number;
  totalPages: number;
}

interface AuditState {
  status: AuditStatus;
  url: string | null;
  progress: AuditProgress;
  result: AuditResult | null;
  ruleMetadata: Record<string, RuleMetadataIpc>;
  error: string | null;

  // Actions
  startAudit: (url: string) => void;
  setCategoryStart: (categoryId: string, categoryName: string) => void;
  setCategoryComplete: (categoryId: string, categoryName: string, result: CategoryResult) => void;
  addRuleComplete: () => void;
  setPageComplete: (page: number, total: number) => void;
  setComplete: (result: AuditResult, ruleMetadata: Record<string, RuleMetadataIpc>) => void;
  setError: (message: string) => void;
  loadHistorical: (url: string, result: AuditResult, ruleMetadata: Record<string, RuleMetadataIpc>) => void;
  reset: () => void;
}

const initialProgress: AuditProgress = {
  completedCategories: [],
  currentCategory: null,
  currentCategoryName: null,
  completedRules: 0,
  currentPage: 0,
  totalPages: 0,
};

export const useAuditStore = create<AuditState>((set) => ({
  status: 'idle',
  url: null,
  progress: { ...initialProgress },
  result: null,
  ruleMetadata: {},
  error: null,

  startAudit: (url) =>
    set({
      status: 'running',
      url,
      progress: { ...initialProgress },
      result: null,
      error: null,
    }),

  setCategoryStart: (categoryId, categoryName) =>
    set((state) => ({
      progress: {
        ...state.progress,
        currentCategory: categoryId,
        currentCategoryName: categoryName,
      },
    })),

  setCategoryComplete: (categoryId, categoryName, result) =>
    set((state) => ({
      progress: {
        ...state.progress,
        completedCategories: [
          ...state.progress.completedCategories,
          { categoryId, categoryName, result },
        ],
        currentCategory: null,
        currentCategoryName: null,
      },
    })),

  addRuleComplete: () =>
    set((state) => ({
      progress: {
        ...state.progress,
        completedRules: state.progress.completedRules + 1,
      },
    })),

  setPageComplete: (page, total) =>
    set((state) => ({
      progress: {
        ...state.progress,
        currentPage: page,
        totalPages: total,
      },
    })),

  setComplete: (result, ruleMetadata) =>
    set({
      status: 'complete',
      result,
      ruleMetadata,
    }),

  setError: (message) =>
    set({
      status: 'error',
      error: message,
    }),

  loadHistorical: (url, result, ruleMetadata) =>
    set({
      status: 'complete',
      url,
      progress: { ...initialProgress },
      result,
      ruleMetadata,
      error: null,
    }),

  reset: () =>
    set({
      status: 'idle',
      url: null,
      progress: { ...initialProgress },
      result: null,
      ruleMetadata: {},
      error: null,
    }),
}));
