/**
 * Shared fixtures for the audits-database tests. Not a test file itself.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { randomBytes } from 'crypto';
import { AuditsDatabase } from './index.js';
import { buildCategoryResult } from '../../scoring.js';
import type { AuditResult, RuleResult, RuleStatus } from '../../types.js';

/** A temporary database file that `cleanup()` removes with its WAL siblings */
export function tempDatabase(): { db: AuditsDatabase; file: string; cleanup: () => void } {
  const file = path.join(os.tmpdir(), `seomator-audits-${randomBytes(4).toString('hex')}.db`);
  const db = AuditsDatabase.open(file);
  return {
    db,
    file,
    cleanup: () => {
      try {
        db.close();
      } catch {
        // already closed by the test
      }
      for (const suffix of ['', '-wal', '-shm']) {
        try {
          fs.unlinkSync(file + suffix);
        } catch {
          // never created
        }
      }
    },
  };
}

/** One rule's outcome on one page */
export interface PageOutcome {
  pageUrl: string;
  status: RuleStatus;
  message?: string;
  /** 0 marks a not-measured reading */
  weight?: number;
}

/** Rules grouped by category id, each with its per-page outcomes */
export type RuleSpec = Record<string, Record<string, PageOutcome[]>>;

const SCORE: Record<RuleStatus, number> = { pass: 100, warn: 50, fail: 0 };

/**
 * Build a live `AuditResult` the way the auditor does: one `RuleResult` per
 * rule per page, categories scored with `buildCategoryResult`.
 */
export function makeAuditResult(url: string, spec: RuleSpec, overallScore = 80): AuditResult {
  const pages = new Set<string>();
  const categoryResults = Object.entries(spec).map(([categoryId, rules]) => {
    const results: RuleResult[] = [];
    for (const [ruleId, outcomes] of Object.entries(rules)) {
      for (const o of outcomes) {
        pages.add(o.pageUrl);
        results.push({
          ruleId,
          status: o.status,
          score: SCORE[o.status],
          message: o.message ?? `${ruleId} ${o.status} on ${o.pageUrl}`,
          details: { pageUrl: o.pageUrl },
          weight: o.weight ?? 1,
        });
      }
    }
    return buildCategoryResult(categoryId, results);
  });
  return {
    url,
    overallScore,
    categoryResults,
    timestamp: new Date().toISOString(),
    crawledPages: pages.size,
  };
}

/** A small single-page audit with one rule in each of two categories */
export function simpleSpec(url: string, status: RuleStatus = 'pass'): RuleSpec {
  return {
    core: { 'core-title': [{ pageUrl: url, status }] },
    perf: { 'perf-ttfb': [{ pageUrl: url, status: 'pass' }] },
  };
}
