/**
 * One audit run, watchable from anywhere.
 *
 * The engine speaks in callbacks, which suits a terminal that prints as it
 * goes but not a UI that can be opened halfway through a run, or two UIs at
 * once. This turns those callbacks into a single bounded state object that
 * subscribers receive on every change and on subscription, so a client that
 * arrives late is immediately correct without any replay.
 *
 * One run at a time. The slot is reserved synchronously, before the first
 * await, so two clicks arriving in the same tick cannot both win it.
 */

import { Auditor, type AuditorOptions } from '../auditor.js';
import type { AuditResult, CategoryResult, RuleResult } from '../types.js';
import { categories as categoryDefinitions, getCategoryById } from '../categories/index.js';
import { AuditAbortedError, classifyError, type AuditErrorCode } from '../errors.js';
import { saveAuditToDatabase, stripUserinfo, type SavedAudit } from '../storage/save-audit.js';
import { generateId } from '../storage/utils/hash.js';
import type { AuditRunOptions, AuditSource } from '../storage/types.js';
import { buildRuleMetadata } from './queries.js';
import type { RuleMetadata } from './contract.js';

/** Rule results kept in the live state; older ones are dropped */
export const MAX_RECENT_RULES = 50;

/**
 * How long a finished run stays available after it ends.
 *
 * One rule for saved and unsaved results alike, so Export and Retry save keep
 * working after a failed save without a second lifetime to reason about. The
 * next run also clears it.
 */
export const RUN_RETENTION_MS = 15 * 60 * 1000;

/** Bounds on what a client may ask for */
export const RUN_LIMITS = {
  maxPages: { min: 1, max: 1000, fallback: 10 },
  concurrency: { min: 1, max: 20, fallback: 3 },
  timeout: { min: 1000, max: 120_000, fallback: 30_000 },
} as const;

/** What a client asks for when starting a run */
export interface AuditRunArgs {
  url: string;
  crawl?: boolean;
  maxPages?: number;
  concurrency?: number;
  measureCwv?: boolean;
  mobile?: boolean;
  simulateInteraction?: boolean;
  categories?: string[];
  timeout?: number;
  /** Store the result. Defaults to true, like the CLI. */
  save?: boolean;
}

/** The same request after validation, safe to hand to the engine */
export interface NormalizedRunArgs extends AuditRunOptions {
  url: string;
  save: boolean;
}

export type RunStatus = 'idle' | 'running' | 'complete' | 'error' | 'cancelled';

/** Where a running audit currently is */
export type RunPhase = 'starting' | 'crawling' | 'auditing' | 'saving' | 'done';

/** A category as the live view shows it: latest result, plus how many pages contributed */
export interface CategoryProgress {
  categoryId: string;
  categoryName: string;
  score: number;
  passCount: number;
  warnCount: number;
  failCount: number;
  notMeasuredCount: number;
  /** Pages this category has been scored on so far */
  pages: number;
}

export interface RunError {
  code: AuditErrorCode;
  message: string;
  hint?: string;
}

/**
 * Everything a client needs to render the run, and nothing that grows without
 * bound: categories are keyed by id rather than appended per page, and only
 * the most recent rule results are kept.
 */
export interface RunState {
  status: RunStatus;
  /** Identifies this run to clients; not the stored audit id */
  runId: string | null;
  url: string | null;
  args: NormalizedRunArgs | null;
  phase: RunPhase;
  startedAt: string | null;
  finishedAt: string | null;
  /** Crawl discovery, before scoring starts */
  crawl: {
    crawled: number;
    total: number;
    discovered: number;
    maxPages: number;
    currentUrl: string;
    done: boolean;
  } | null;
  /** Page scoring */
  pages: { completed: number; total: number; currentUrl: string | null };
  /**
   * When the first page finished scoring.
   *
   * A projection measured from `startedAt` would fold in the crawl and the
   * browser launch, both of which are one-off costs, and would overstate the
   * remaining time for the whole run. Measuring from the first completed page
   * over the pages completed since gives the steady-state rate.
   *
   * Server-side because SSE hands a late client a snapshot, not a history: a
   * browser that connects halfway through has no way to time what it missed.
   */
  firstPageAt: string | null;
  /**
   * When the most recent page finished.
   *
   * The rate has to be measured over completed work only. Dividing by `now`
   * instead inflates it for as long as the current page is in flight, so the
   * projection counts *up* between completions — 76 seconds remaining becoming
   * 127 while nothing was wrong. A countdown that grows is worse than none.
   */
  lastPageAt: string | null;
  categories: CategoryProgress[];
  recentRules: Array<{ ruleId: string; ruleName: string; status: RuleResult['status']; message: string }>;
  /** Set once the finished audit has been stored */
  auditId: string | null;
  error: RunError | null;
}

/** What this build can actually do, so a UI does not offer what will not work */
export interface Capabilities {
  /** A browser render is available (Core Web Vitals, rendered DOM) */
  browserRender: boolean;
  /** Rendering a second time at a mobile viewport */
  mobileParity: boolean;
  /** Driving a synthetic interaction so INP can be measured */
  simulateInteraction: boolean;
  /** Finished audits can be stored */
  persistence: boolean;
}

export const DEFAULT_CAPABILITIES: Capabilities = {
  browserRender: true,
  mobileParity: true,
  simulateInteraction: true,
  persistence: true,
};

export interface AuditSessionOptions {
  /** Which surface this session belongs to; recorded on stored audits */
  source: AuditSource;
  /** What this build can do. The defaults describe the Playwright engine. */
  capabilities?: Partial<Capabilities>;
  /** Extra engine options, e.g. Electron's own browser fetcher */
  auditorOptions?: Pick<AuditorOptions, 'browserFetcher' | 'respectRobots'>;
  /** Injectable for tests */
  createAuditor?: (options: AuditorOptions) => Auditor;
  /** Injectable for tests */
  saveAudit?: typeof saveAuditToDatabase;
  /** Injectable for tests */
  now?: () => Date;
}

function clamp(value: number | undefined, limits: { min: number; max: number; fallback: number }): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return limits.fallback;
  return Math.min(limits.max, Math.max(limits.min, Math.trunc(value)));
}

/**
 * Validate and bound a run request.
 *
 * The dashboard accepts these over HTTP, so nothing here may be trusted: the
 * URL must be http(s), the numbers are clamped, and unknown category ids are
 * dropped rather than producing an audit of nothing.
 *
 * @throws Error when the URL is missing or not an http(s) URL
 */
export function normalizeRunArgs(args: AuditRunArgs, capabilities: Capabilities): NormalizedRunArgs {
  let parsed: URL;
  try {
    parsed = new URL(args.url);
  } catch {
    throw new Error(`Not a valid URL: ${args.url}`);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Only http and https URLs can be audited, got ${parsed.protocol}`);
  }

  const known = new Set(categoryDefinitions.map((c) => c.id));
  const requested = (args.categories ?? []).filter((id) => known.has(id));

  const measureCwv = (args.measureCwv ?? true) && capabilities.browserRender;

  return {
    url: parsed.href,
    crawl: args.crawl === true,
    maxPages: clamp(args.maxPages, RUN_LIMITS.maxPages),
    concurrency: clamp(args.concurrency, RUN_LIMITS.concurrency),
    timeout: clamp(args.timeout, RUN_LIMITS.timeout),
    measureCwv,
    mobile: args.mobile === true && measureCwv && capabilities.mobileParity,
    simulateInteraction:
      args.simulateInteraction === true && measureCwv && capabilities.simulateInteraction,
    categories: requested,
    save: (args.save ?? true) && capabilities.persistence,
  };
}

const IDLE_STATE: RunState = {
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

/** What a finished run hands back */
export interface RunOutcome {
  runId: string;
  result: AuditResult;
  ruleMetadata: Record<string, RuleMetadata>;
  saved: SavedAudit | null;
  /** Set when the audit finished but could not be stored */
  saveError?: string;
}

export class AuditSession {
  private state: RunState = IDLE_STATE;
  private listeners = new Set<(state: RunState) => void>();
  private controller: AbortController | null = null;
  private running: Promise<RunOutcome> | null = null;
  private lastOutcome: RunOutcome | null = null;
  /** When the retained outcome stops being available */
  private retainedUntil = 0;
  /** The args the retained run used, so a save retry records the same thing */
  private retainedArgs: NormalizedRunArgs | null = null;

  readonly capabilities: Capabilities;
  private readonly options: Required<Pick<AuditSessionOptions, 'source'>> & AuditSessionOptions;

  constructor(options: AuditSessionOptions) {
    this.options = options;
    this.capabilities = { ...DEFAULT_CAPABILITIES, ...options.capabilities };
  }

  /** The current state; always safe to render */
  getState(): RunState {
    return this.state;
  }

  /**
   * The most recent finished run, for clients that arrive after it ended.
   *
   * Expires, so a dashboard left open overnight is not holding a 1,000-page
   * result in memory.
   */
  getLastOutcome(): RunOutcome | null {
    if (this.lastOutcome && this.now().getTime() > this.retainedUntil) {
      this.lastOutcome = null;
      this.retainedArgs = null;
    }
    return this.lastOutcome;
  }

  /**
   * A run by id: the one in progress, or the retained finished one.
   *
   * @returns Its state, or null when that run is not the one being retained
   */
  getRun(runId: string): RunState | null {
    if (this.state.runId === runId) return this.state;
    return null;
  }

  /** The aggregated result of a retained run, for a client that has to render it */
  getResult(runId: string): RunOutcome | null {
    const outcome = this.getLastOutcome();
    return outcome && outcome.runId === runId ? outcome : null;
  }

  /**
   * Store a finished run that could not be saved the first time.
   *
   * The Retry save action: same result, same provenance, so a transient
   * failure (a locked database, a full disk since cleared) does not cost the
   * user the audit they just waited for.
   *
   * @returns The stored audit, or null when there is nothing retained to save
   * @throws Whatever the save failed with, so the caller can show it
   */
  persist(runId: string): SavedAudit | null {
    const outcome = this.getResult(runId);
    if (!outcome || outcome.saved || !this.retainedArgs) return null;

    const save = this.options.saveAudit ?? saveAuditToDatabase;
    const args = this.retainedArgs;
    const saved = save(outcome.result, {
      source: this.options.source,
      run: {
        crawl: args.crawl,
        maxPages: args.maxPages,
        concurrency: args.concurrency,
        measureCwv: args.measureCwv,
        mobile: args.mobile,
        simulateInteraction: args.simulateInteraction,
        categories: args.categories,
        timeout: args.timeout,
      },
    });

    outcome.saved = saved;
    delete outcome.saveError;
    if (this.state.runId === runId) {
      this.patch({ auditId: saved.auditId });
    }
    return saved;
  }

  isRunning(): boolean {
    return this.running !== null;
  }

  /**
   * Watch the run. The current state arrives immediately, so a client that
   * connects mid-run needs no replay.
   *
   * @returns Unsubscribe
   */
  subscribe(listener: (state: RunState) => void): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Start a run.
   *
   * The slot is taken synchronously: by the time this returns, a second
   * caller in the same tick already sees the session as busy.
   *
   * @throws Error when a run is already in progress or the request is invalid
   */
  start(args: AuditRunArgs): Promise<RunOutcome> {
    if (this.running) {
      throw new Error('An audit is already running');
    }

    const normalized = normalizeRunArgs(args, this.capabilities);
    // A new run replaces whatever was being retained.
    this.lastOutcome = null;
    this.retainedArgs = null;
    const runId = generateId();
    const controller = new AbortController();
    this.controller = controller;

    this.setState({
      ...IDLE_STATE,
      status: 'running',
      runId,
      url: normalized.url,
      args: normalized,
      phase: normalized.crawl ? 'crawling' : 'auditing',
      startedAt: this.now().toISOString(),
      crawl: normalized.crawl
        ? {
            crawled: 0,
            total: 0,
            discovered: 0,
            maxPages: normalized.maxPages,
            currentUrl: '',
            done: false,
          }
        : null,
      pages: { completed: 0, total: normalized.crawl ? 0 : 1, currentUrl: null },
      firstPageAt: null,
      lastPageAt: null,
    });

    // Assigned before any await, so the slot is held from here on.
    this.running = this.run(runId, normalized, controller).finally(() => {
      this.running = null;
      this.controller = null;
    });
    return this.running;
  }

  /**
   * Cancel the run in progress. Safe to call when nothing is running.
   *
   * @returns True when a run was actually cancelled
   */
  cancel(): boolean {
    if (!this.controller || this.controller.signal.aborted) return false;
    this.controller.abort();
    return true;
  }

  private now(): Date {
    return this.options.now?.() ?? new Date();
  }

  private setState(next: RunState): void {
    this.state = next;
    for (const listener of this.listeners) {
      listener(next);
    }
  }

  private patch(change: Partial<RunState>): void {
    this.setState({ ...this.state, ...change });
  }

  /** Fold one category result into the bounded per-category view */
  private recordCategory(categoryId: string, categoryName: string, result: CategoryResult): void {
    const categories = [...this.state.categories];
    const index = categories.findIndex((c) => c.categoryId === categoryId);
    const entry: CategoryProgress = {
      categoryId,
      categoryName,
      score: result.score,
      passCount: result.passCount,
      warnCount: result.warnCount,
      failCount: result.failCount,
      notMeasuredCount: result.notMeasuredCount ?? 0,
      pages: (categories[index]?.pages ?? 0) + 1,
    };
    // In crawl mode every category completes once per page. Replacing the
    // entry keeps the list at one row per category instead of one per page.
    if (index === -1) categories.push(entry);
    else categories[index] = entry;
    this.patch({ categories });
  }

  private async run(
    runId: string,
    args: NormalizedRunArgs,
    controller: AbortController
  ): Promise<RunOutcome> {
    const makeAuditor = this.options.createAuditor ?? ((o: AuditorOptions) => new Auditor(o));
    const save = this.options.saveAudit ?? saveAuditToDatabase;

    const auditor = makeAuditor({
      ...this.options.auditorOptions,
      categories: args.categories,
      timeout: args.timeout,
      measureCwv: args.measureCwv,
      mobileParity: args.mobile,
      simulateInteraction: args.simulateInteraction,
      signal: controller.signal,
      onCrawlProgress: (progress) => {
        this.patch({
          phase: progress.done ? 'auditing' : 'crawling',
          crawl: {
            crawled: progress.crawled,
            total: progress.total,
            discovered: progress.discovered,
            maxPages: progress.maxPages,
            currentUrl: progress.currentUrl,
            done: progress.done,
          },
          ...(progress.done && {
            pages: { ...this.state.pages, total: progress.crawled },
          }),
        });
      },
      onCategoryComplete: (categoryId, categoryName, result) => {
        this.recordCategory(categoryId, categoryName, result);
      },
      onRuleComplete: (ruleId, ruleName, result) => {
        const recentRules = [
          ...this.state.recentRules,
          { ruleId, ruleName, status: result.status, message: result.message },
        ];
        this.patch({
          recentRules:
            recentRules.length > MAX_RECENT_RULES
              ? recentRules.slice(recentRules.length - MAX_RECENT_RULES)
              : recentRules,
        });
      },
      onPageComplete: (pageUrl, pageNumber, totalPages) => {
        this.patch({
          phase: 'auditing',
          pages: { completed: pageNumber, total: totalPages, currentUrl: stripUserinfo(pageUrl) },
          // First stamped once; last on every completion, so the rate is
          // measured between completions and not against a moving clock.
          lastPageAt: new Date().toISOString(),
          ...(this.state.firstPageAt === null && { firstPageAt: new Date().toISOString() }),
        });
      },
    });

    try {
      const result = args.crawl
        ? await auditor.auditWithCrawl(args.url, args.maxPages, args.concurrency)
        : await auditor.audit(args.url);

      const outcome: RunOutcome = {
        runId,
        result,
        ruleMetadata: buildRuleMetadata(
          result.categoryResults.flatMap((c) =>
            c.results.map((r) => ({ ruleId: r.ruleId, ruleName: r.ruleId }))
          )
        ),
        saved: null,
      };

      if (args.save) {
        this.patch({ phase: 'saving' });
        try {
          outcome.saved = save(result, {
            source: this.options.source,
            run: {
              crawl: args.crawl,
              maxPages: args.maxPages,
              concurrency: args.concurrency,
              measureCwv: args.measureCwv,
              mobile: args.mobile,
              simulateInteraction: args.simulateInteraction,
              categories: args.categories,
              timeout: args.timeout,
            },
          });
        } catch (error) {
          // A finished audit is worth showing even when it could not be
          // stored; the client is told so it can offer to export instead.
          outcome.saveError = error instanceof Error ? error.message : String(error);
        }
      }

      this.lastOutcome = outcome;
      this.retainedArgs = args;
      this.retainedUntil = this.now().getTime() + RUN_RETENTION_MS;
      this.patch({
        status: 'complete',
        phase: 'done',
        finishedAt: this.now().toISOString(),
        auditId: outcome.saved?.auditId ?? null,
      });
      return outcome;
    } catch (error) {
      const finishedAt = this.now().toISOString();
      if (error instanceof AuditAbortedError || controller.signal.aborted) {
        this.patch({ status: 'cancelled', phase: 'done', finishedAt });
      } else {
        const audited = classifyError(error);
        this.patch({
          status: 'error',
          phase: 'done',
          finishedAt,
          error: {
            code: audited.code,
            message: audited.message,
            ...(audited.hint && { hint: audited.hint }),
          },
        });
      }
      throw error;
    }
  }
}

/** Category display names, so a client need not carry its own copy */
export function categoryName(categoryId: string): string {
  return getCategoryById(categoryId)?.name ?? categoryId;
}
