import { describe, it, expect, vi } from 'vitest';
import { AuditSession, normalizeRunArgs, MAX_RECENT_RULES, DEFAULT_CAPABILITIES } from './audit-session.js';
import type { RunState } from './audit-session.js';
import { AuditAbortedError, AuditError } from '../errors.js';
import type { Auditor, AuditorOptions } from '../auditor.js';
import type { AuditResult } from '../types.js';

const URL_UNDER_TEST = 'https://session.test/';

function makeResult(url = URL_UNDER_TEST): AuditResult {
  return {
    url,
    overallScore: 77,
    categoryResults: [
      {
        categoryId: 'core',
        score: 80,
        passCount: 2,
        warnCount: 1,
        failCount: 0,
        notMeasuredCount: 0,
        results: [
          { ruleId: 'core-title', status: 'pass', score: 100, message: 'ok', weight: 1 },
          { ruleId: 'core-h1', status: 'warn', score: 50, message: 'meh', weight: 1 },
        ],
      },
    ],
    timestamp: new Date().toISOString(),
    crawledPages: 1,
  };
}

/**
 * A stand-in Auditor whose run resolves when the test says so, exposing the
 * callbacks the session wired up.
 */
function makeFakeAuditor() {
  let captured: AuditorOptions = {};
  let settle!: (result: AuditResult) => void;
  let reject!: (error: unknown) => void;
  const pending = new Promise<AuditResult>((res, rej) => {
    settle = res;
    reject = rej;
  });

  const createAuditor = (options: AuditorOptions): Auditor => {
    captured = options;
    return {
      audit: () => pending,
      auditWithCrawl: () => pending,
    } as unknown as Auditor;
  };

  return {
    createAuditor,
    settle,
    reject,
    callbacks: () => captured,
  };
}

describe('normalizeRunArgs', () => {
  it('clamps numbers and drops unknown categories', () => {
    const args = normalizeRunArgs(
      {
        url: URL_UNDER_TEST,
        crawl: true,
        maxPages: 99999,
        concurrency: 0,
        timeout: 5,
        categories: ['core', 'not-a-category', 'perf'],
      },
      DEFAULT_CAPABILITIES
    );
    expect(args.maxPages).toBe(1000);
    expect(args.concurrency).toBe(1);
    expect(args.timeout).toBe(1000);
    expect(args.categories).toEqual(['core', 'perf']);
    expect(args.crawl).toBe(true);
  });

  it('rejects anything that is not an http(s) URL', () => {
    expect(() => normalizeRunArgs({ url: 'not a url' }, DEFAULT_CAPABILITIES)).toThrow(/valid URL/);
    expect(() => normalizeRunArgs({ url: 'file:///etc/passwd' }, DEFAULT_CAPABILITIES)).toThrow(/http and https/);
    expect(() => normalizeRunArgs({ url: 'javascript:alert(1)' }, DEFAULT_CAPABILITIES)).toThrow(/http and https/);
  });

  it('turns off what the build cannot do rather than failing', () => {
    const args = normalizeRunArgs(
      { url: URL_UNDER_TEST, measureCwv: true, mobile: true, simulateInteraction: true, save: true },
      { browserRender: false, mobileParity: false, simulateInteraction: false, persistence: false }
    );
    expect(args.measureCwv).toBe(false);
    expect(args.mobile).toBe(false);
    expect(args.simulateInteraction).toBe(false);
    expect(args.save).toBe(false);
  });

  it('defaults to measuring and saving', () => {
    const args = normalizeRunArgs({ url: URL_UNDER_TEST }, DEFAULT_CAPABILITIES);
    expect(args.measureCwv).toBe(true);
    expect(args.save).toBe(true);
    expect(args.crawl).toBe(false);
    expect(args.maxPages).toBe(10);
  });
});

describe('AuditSession', () => {
  it('reserves the run slot synchronously', () => {
    const fake = makeFakeAuditor();
    const session = new AuditSession({
      source: 'dashboard',
      createAuditor: fake.createAuditor,
      saveAudit: vi.fn(),
    });

    const first = session.start({ url: URL_UNDER_TEST, save: false });
    // Same tick: the second caller must lose, not start a parallel audit
    expect(() => session.start({ url: URL_UNDER_TEST })).toThrow(/already running/);
    expect(session.isRunning()).toBe(true);

    fake.settle(makeResult());
    return first.then(() => {
      expect(session.isRunning()).toBe(false);
    });
  });

  it('gives a late subscriber the current state immediately', async () => {
    const fake = makeFakeAuditor();
    const session = new AuditSession({ source: 'dashboard', createAuditor: fake.createAuditor });

    const run = session.start({ url: URL_UNDER_TEST, save: false });
    fake.callbacks().onPageComplete?.(URL_UNDER_TEST, 1, 1);

    const seen: RunState[] = [];
    session.subscribe((s) => seen.push(s));
    expect(seen).toHaveLength(1);
    expect(seen[0]!.status).toBe('running');
    expect(seen[0]!.pages.completed).toBe(1);

    fake.settle(makeResult());
    await run;
    expect(seen[seen.length - 1]!.status).toBe('complete');
  });

  it('keeps one row per category however many pages it is scored on', async () => {
    const fake = makeFakeAuditor();
    const session = new AuditSession({ source: 'dashboard', createAuditor: fake.createAuditor });
    const run = session.start({ url: URL_UNDER_TEST, crawl: true, maxPages: 5, save: false });

    const category = makeResult().categoryResults[0]!;
    for (let page = 0; page < 5; page++) {
      fake.callbacks().onCategoryComplete?.('core', 'Core SEO', category);
    }

    expect(session.getState().categories).toHaveLength(1);
    expect(session.getState().categories[0]!.pages).toBe(5);
    expect(session.getState().categories[0]!.categoryName).toBe('Core SEO');

    fake.settle(makeResult());
    await run;
  });

  it('bounds the rule feed', async () => {
    const fake = makeFakeAuditor();
    const session = new AuditSession({ source: 'dashboard', createAuditor: fake.createAuditor });
    const run = session.start({ url: URL_UNDER_TEST, save: false });

    for (let i = 0; i < MAX_RECENT_RULES * 3; i++) {
      fake.callbacks().onRuleComplete?.(`rule-${i}`, `Rule ${i}`, {
        ruleId: `rule-${i}`,
        status: 'pass',
        score: 100,
        message: 'ok',
      });
    }

    const { recentRules } = session.getState();
    expect(recentRules).toHaveLength(MAX_RECENT_RULES);
    expect(recentRules[recentRules.length - 1]!.ruleId).toBe(`rule-${MAX_RECENT_RULES * 3 - 1}`);

    fake.settle(makeResult());
    await run;
  });

  it('tracks crawl discovery, then switches to scoring', async () => {
    const fake = makeFakeAuditor();
    const session = new AuditSession({ source: 'dashboard', createAuditor: fake.createAuditor });
    const run = session.start({ url: URL_UNDER_TEST, crawl: true, maxPages: 20, save: false });

    expect(session.getState().phase).toBe('crawling');
    fake.callbacks().onCrawlProgress?.({
      crawled: 3,
      total: 12,
      discovered: 30,
      maxPages: 20,
      currentUrl: 'https://session.test/a',
      done: false,
    });
    expect(session.getState().crawl).toMatchObject({ crawled: 3, total: 12, discovered: 30 });

    fake.callbacks().onCrawlProgress?.({
      crawled: 7,
      total: 7,
      discovered: 30,
      maxPages: 20,
      currentUrl: '',
      done: true,
    });
    expect(session.getState().phase).toBe('auditing');
    expect(session.getState().pages.total).toBe(7);

    fake.settle(makeResult());
    await run;
  });

  it('stores the finished audit with its provenance and reports the audit id', async () => {
    const fake = makeFakeAuditor();
    const saveAudit = vi.fn(() => ({ auditId: '2026-09-03-aaa111', id: 1, domain: 'session.test', previousAuditId: null }));
    const session = new AuditSession({
      source: 'desktop',
      createAuditor: fake.createAuditor,
      saveAudit: saveAudit as never,
    });

    const run = session.start({ url: URL_UNDER_TEST, crawl: true, maxPages: 4 });
    fake.settle(makeResult());
    const outcome = await run;

    expect(saveAudit).toHaveBeenCalledOnce();
    expect(saveAudit.mock.calls[0]![1]).toMatchObject({
      source: 'desktop',
      run: { crawl: true, maxPages: 4 },
    });
    expect(outcome.saved?.auditId).toBe('2026-09-03-aaa111');
    expect(session.getState().auditId).toBe('2026-09-03-aaa111');
    expect(session.getState().status).toBe('complete');
    expect(outcome.ruleMetadata['core-title']).toBeDefined();
  });

  it('keeps the result when it cannot be stored', async () => {
    const fake = makeFakeAuditor();
    const session = new AuditSession({
      source: 'dashboard',
      createAuditor: fake.createAuditor,
      saveAudit: (() => {
        throw new Error('disk is full');
      }) as never,
    });

    const run = session.start({ url: URL_UNDER_TEST });
    fake.settle(makeResult());
    const outcome = await run;

    expect(outcome.saveError).toBe('disk is full');
    expect(outcome.saved).toBeNull();
    expect(session.getState().status).toBe('complete');
    expect(session.getState().auditId).toBeNull();
  });

  it('reports a cancellation as cancelled, not as an error', async () => {
    const fake = makeFakeAuditor();
    const session = new AuditSession({ source: 'dashboard', createAuditor: fake.createAuditor });
    const run = session.start({ url: URL_UNDER_TEST, save: false });

    expect(session.cancel()).toBe(true);
    expect(fake.callbacks().signal?.aborted).toBe(true);
    // A second cancel is a no-op rather than an error
    expect(session.cancel()).toBe(false);

    fake.reject(new AuditAbortedError());
    await expect(run).rejects.toBeInstanceOf(AuditAbortedError);
    expect(session.getState().status).toBe('cancelled');
    expect(session.getState().error).toBeNull();
    expect(session.isRunning()).toBe(false);

    // The slot is free again
    const second = session.start({ url: URL_UNDER_TEST, save: false });
    expect(session.isRunning()).toBe(true);
    session.cancel();
    await expect(second).rejects.toBeTruthy();
  });

  it('classifies a failure into a code and a hint', async () => {
    const fake = makeFakeAuditor();
    const session = new AuditSession({ source: 'dashboard', createAuditor: fake.createAuditor });
    const run = session.start({ url: URL_UNDER_TEST, save: false });

    fake.reject(new AuditError('non-html', 'https://session.test/ returned application/json, which is not an HTML page'));
    await expect(run).rejects.toBeInstanceOf(AuditError);

    const { error, status } = session.getState();
    expect(status).toBe('error');
    expect(error?.code).toBe('non-html');
    expect(error?.hint).toContain('HTML page');
  });

  it('cancel() on an idle session does nothing', () => {
    const session = new AuditSession({ source: 'dashboard' });
    expect(session.cancel()).toBe(false);
    expect(session.getState().status).toBe('idle');
  });
});
