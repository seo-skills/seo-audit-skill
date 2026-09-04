import type { AuditResult } from '../types.js';
import type { SeomatorConfig } from '../config/schema.js';
import type {
  AuditRunOptions,
  AuditSource,
  InsertCategoryInput,
  InsertResultInput,
  RuleResultStatus,
} from './types.js';
import { getAuditsDatabase, type AuditsDatabase } from './audits-db/index.js';
import { getCategoryById } from '../categories/index.js';
import { getRuleById } from '../rules/registry.js';
import { generateId } from './utils/hash.js';
import { getVersion } from '../version.js';

/**
 * Writes a completed audit into the audits database.
 *
 * One transaction per audit: the audit row, its categories, every per-page
 * rule row, the completion stats and the comparison against the previous run
 * either all land or none do. A crash halfway leaves no half-written audit for
 * the dashboard to trip over.
 */

/** The domain an audit is filed under, used to group runs for comparison */
export function domainOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

/**
 * Drop `user:password@` from a URL before it is stored.
 *
 * Audits of staging sites behind basic auth pass credentials in the URL. They
 * are needed to fetch, never to display, and the database is world-readable
 * to anything running as the user.
 */
export function stripUserinfo(url: string): string {
  try {
    const parsed = new URL(url);
    if (!parsed.username && !parsed.password) return url;
    parsed.username = '';
    parsed.password = '';
    return parsed.href;
  } catch {
    return url;
  }
}

export interface SavedAudit {
  /** Human-facing audit id, e.g. 2026-08-31-a1b2c3 */
  auditId: string;
  /** Database row id */
  id: number;
  /** Domain the audit was filed under */
  domain: string;
  /** The audit this one was compared against, when there was one */
  previousAuditId: string | null;
}

export interface SaveAuditOptions {
  projectName?: string;
  config?: SeomatorConfig;
  /** Which surface ran the audit. Defaults to 'cli'. */
  source?: AuditSource;
  /** The options the audit ran with, stored so it can be re-run */
  run?: AuditRunOptions;
  /** Database to write to. Defaults to the global singleton. */
  db?: AuditsDatabase;
  /** How long to keep retrying when another process holds the write lock */
  retry?: BusyRetryOptions;
}

export interface BusyRetryOptions {
  /** Total attempts including the first. Default 20 (≈10 s at 500 ms). */
  attempts?: number;
  /** Pause between attempts in milliseconds. Default 500. */
  delayMs?: number;
  /** Injectable pause, for tests */
  sleep?: (ms: number) => void;
}

function isBusy(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  return code === 'SQLITE_BUSY' || code === 'SQLITE_BUSY_SNAPSHOT' || code === 'SQLITE_LOCKED';
}

function blockingSleep(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/**
 * Run a write, retrying while SQLite reports the file busy.
 *
 * `busy_timeout` is set to 500 ms on every connection; that covers a checkpoint
 * or a short write. A dashboard save that runs for seconds needs more, and
 * these retries give it up to ten seconds by default before the error reaches
 * the user.
 */
export function withBusyRetry<T>(fn: () => T, options: BusyRetryOptions = {}): T {
  const attempts = Math.max(1, options.attempts ?? 20);
  const delayMs = options.delayMs ?? 500;
  const sleep = options.sleep ?? blockingSleep;

  for (let attempt = 1; ; attempt++) {
    try {
      return fn();
    } catch (error) {
      if (!isBusy(error) || attempt >= attempts) throw error;
      sleep(delayMs);
    }
  }
}

/**
 * Persist an audit result and its per-rule detail.
 *
 * @param result - The completed audit
 * @param options - Provenance, project name, config and the database to use
 * @returns Identifiers for the stored audit
 */
export function saveAuditToDatabase(result: AuditResult, options: SaveAuditOptions = {}): SavedAudit {
  const db = options.db ?? getAuditsDatabase();
  const auditId = generateId();
  const startUrl = stripUserinfo(result.url);
  const domain = domainOf(startUrl);

  const categoryInputs: InsertCategoryInput[] = [];
  const resultInputs: InsertResultInput[] = [];
  let passedCount = 0;
  let warningCount = 0;
  let failedCount = 0;

  for (const category of result.categoryResults) {
    const definition = getCategoryById(category.categoryId);

    categoryInputs.push({
      categoryId: category.categoryId,
      categoryName: definition?.name ?? category.categoryId,
      score: category.score,
      weight: definition?.weight ?? 0,
      passCount: category.passCount,
      warnCount: category.warnCount,
      failCount: category.failCount,
    });

    passedCount += category.passCount;
    warningCount += category.warnCount;
    failedCount += category.failCount;

    for (const ruleResult of category.results) {
      const rule = getRuleById(ruleResult.ruleId);
      const pageUrl =
        typeof ruleResult.details?.pageUrl === 'string' ? ruleResult.details.pageUrl : result.url;

      resultInputs.push({
        categoryId: category.categoryId,
        ruleId: ruleResult.ruleId,
        ruleName: rule?.name ?? ruleResult.ruleId,
        pageUrl: stripUserinfo(pageUrl),
        status: ruleResult.status as RuleResultStatus,
        score: ruleResult.score,
        message: ruleResult.message,
        weight: ruleResult.weight ?? 1,
        ...(ruleResult.details && { details: ruleResult.details }),
      });
    }
  }

  const write = db.getDb().transaction((): SavedAudit => {
    const audit = db.createAudit({
      auditId,
      domain,
      startUrl,
      source: options.source ?? 'cli',
      engineVersion: getVersion(),
      ...(options.run && { run: options.run }),
      ...(options.projectName && { projectName: options.projectName }),
      ...(options.config && { config: options.config }),
    });

    db.insertCategories(audit.id, categoryInputs);
    db.insertResults(audit.id, resultInputs);

    db.completeAudit(auditId, {
      overallScore: result.overallScore,
      totalRules: resultInputs.length,
      passedCount,
      warningCount,
      failedCount,
      pagesAudited: result.crawledPages,
    });

    const previous = db.getPreviousAudit(domain, auditId);
    if (previous) {
      db.recordComparison(audit.id, previous.id);
    }

    return { auditId, id: audit.id, domain, previousAuditId: previous?.auditId ?? null };
  });

  return withBusyRetry(() => write(), options.retry);
}
