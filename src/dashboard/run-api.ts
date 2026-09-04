/**
 * Starting, watching and cancelling a run over HTTP.
 *
 * The session owns the run; these handlers only translate. Option validation
 * is strict on purpose: an unknown key or an out-of-range number is a `400`
 * rather than a silent default, because an agent that mistypes `maxPages`
 * should be told, not quietly given ten pages.
 */

import { getVersion } from '../version.js';
import { classifyError } from '../errors.js';
import { ApiError, notFound } from './errors.js';
import { HANDLED, Responded, readJsonBody, type RequestContext, type Route } from './server.js';
import { RUN_LIMITS, type AuditRunArgs, type AuditSession } from './audit-session.js';
import { aggregateResult } from './aggregate.js';
import type { AuditMetaDto } from './contract.js';
import type { EventHub } from './events.js';
import {
  renderHtmlReport,
  renderMarkdownReport,
  renderLlmReport,
} from '../reporters/index.js';

/** Everything a run request may carry. Anything else is a 400. */
const ALLOWED_OPTIONS = new Set([
  'crawl',
  'maxPages',
  'concurrency',
  'measureCwv',
  'mobile',
  'simulateInteraction',
  'categories',
  'timeout',
  'save',
]);

const NUMERIC_OPTIONS = {
  maxPages: RUN_LIMITS.maxPages,
  concurrency: RUN_LIMITS.concurrency,
  timeout: RUN_LIMITS.timeout,
} as const;

const BOOLEAN_OPTIONS = ['crawl', 'measureCwv', 'mobile', 'simulateInteraction', 'save'] as const;

function invalidOption(option: string, allowed: unknown, received: unknown): ApiError {
  return new ApiError(400, 'invalid-option', `"${option}" is not valid.`, {
    details: { option, allowed, received },
  });
}

/**
 * Validate a run request body.
 *
 * @throws ApiError on anything unrecognised or out of range
 */
export function parseRunArgs(body: Record<string, unknown>): AuditRunArgs {
  const url = body.url;
  if (typeof url !== 'string' || url.length === 0) {
    throw new ApiError(400, 'invalid-option', 'A "url" is required.', {
      details: { option: 'url' },
      hint: 'POST { "url": "https://example.com" }',
    });
  }
  if (url.length > 2048) {
    throw invalidOption('url', 'at most 2048 characters', `${url.length} characters`);
  }

  // Options may be nested under `options` or sit at the top level; both read
  // naturally from a shell and neither should be a surprise.
  const rawOptions =
    typeof body.options === 'object' && body.options !== null && !Array.isArray(body.options)
      ? (body.options as Record<string, unknown>)
      : Object.fromEntries(Object.entries(body).filter(([key]) => key !== 'url'));

  for (const key of Object.keys(rawOptions)) {
    if (!ALLOWED_OPTIONS.has(key)) {
      throw invalidOption(key, [...ALLOWED_OPTIONS], rawOptions[key]);
    }
  }

  const args: AuditRunArgs = { url };

  for (const key of BOOLEAN_OPTIONS) {
    const value = rawOptions[key];
    if (value === undefined) continue;
    if (typeof value !== 'boolean') throw invalidOption(key, 'true or false', value);
    args[key] = value;
  }

  for (const key of Object.keys(NUMERIC_OPTIONS) as Array<keyof typeof NUMERIC_OPTIONS>) {
    const limits = NUMERIC_OPTIONS[key];
    const value = rawOptions[key];
    if (value === undefined) continue;
    if (typeof value !== 'number' || !Number.isInteger(value) || value < limits.min || value > limits.max) {
      throw invalidOption(key, `an integer between ${limits.min} and ${limits.max}`, value);
    }
    args[key] = value;
  }

  const categories = rawOptions.categories;
  if (categories !== undefined) {
    if (!Array.isArray(categories) || categories.some((c) => typeof c !== 'string')) {
      throw invalidOption('categories', 'an array of category ids', categories);
    }
    args.categories = categories as string[];
  }

  return args;
}

export interface RunApiDependencies {
  session: AuditSession;
  events: EventHub;
}

/** A stand-in audit row for a run that was never stored */
function unsavedMeta(session: AuditSession, runId: string): AuditMetaDto {
  const state = session.getState();
  const outcome = session.getResult(runId);
  const url = outcome?.result.url ?? state.url ?? '';
  let domain = url;
  try {
    domain = new URL(url).hostname;
  } catch {
    // A URL that will not parse cannot have been audited; leave it as-is.
  }

  return {
    id: 0,
    auditId: runId,
    domain,
    projectName: null,
    startUrl: url,
    overallScore: outcome?.result.overallScore ?? 0,
    pagesAudited: outcome?.result.crawledPages ?? 0,
    passedCount: 0,
    warningCount: 0,
    failedCount: 0,
    startedAt: state.startedAt ?? new Date().toISOString(),
    completedAt: state.finishedAt,
    status: 'completed',
    source: 'dashboard',
    engineVersion: getVersion(),
    totalRules: 0,
    run: state.args
      ? {
          crawl: state.args.crawl,
          maxPages: state.args.maxPages,
          concurrency: state.args.concurrency,
          measureCwv: state.args.measureCwv,
          mobile: state.args.mobile,
          simulateInteraction: state.args.simulateInteraction,
          categories: state.args.categories,
          timeout: state.args.timeout,
        }
      : null,
  };
}

export function createRunRoutes(deps: RunApiDependencies): Route[] {
  const { session, events } = deps;

  return [
    {
      method: 'POST',
      path: '/api/runs',
      purpose: 'Start an audit; 409 when one is already running',
      handler: async (context: RequestContext) => {
        const body = await readJsonBody(context.req);
        const args = parseRunArgs(body);

        try {
          const state = session.getState();
          // Started, not awaited: the caller follows the run on /api/events.
          const run = session.start(args);
          run.catch(() => {
            // The failure is already in the run state, which is what every
            // client reads. An unhandled rejection here would only be noise.
          });
          void state;
        } catch (error) {
          if (session.isRunning()) {
            const current = session.getState();
            throw new ApiError(409, 'run-in-progress', 'An audit is already running.', {
              hint: 'Cancel it with DELETE /api/runs/current, or wait for it to finish.',
              details: { currentRun: { runId: current.runId, url: current.url, phase: current.phase } },
              headers: { Location: '/api/runs/current' },
            });
          }
          // A rejected request, not a busy server.
          const audited = classifyError(error);
          throw new ApiError(400, 'invalid-option', audited.message, {
            ...(audited.hint && { hint: audited.hint }),
          });
        }

        const started = session.getState();
        return new Responded(
          202,
          { runId: started.runId, run: started },
          { Location: '/api/runs/current' }
        );
      },
    },
    {
      method: 'GET',
      path: '/api/runs/current',
      // Always 200 with a nullable body: a 204 would make `.json()` throw in
      // every client that does not special-case it.
      purpose: 'The run in progress, or null',
      handler: () => ({ run: session.isRunning() ? session.getState() : null }),
    },
    {
      method: 'DELETE',
      path: '/api/runs/current',
      purpose: 'Cancel the run in progress',
      handler: () =>
        session.cancel() ? new Responded(202, { cancelled: true }) : new Responded(204, undefined),
    },
    {
      method: 'GET',
      path: '/api/runs/:runId',
      purpose: 'The state of a run, current or just finished',
      handler: (context) => {
        const state = session.getRun(context.params.runId ?? '');
        if (!state) throw notFound(`Run ${context.params.runId}`, 'Only the current or most recent run is kept.');
        return state;
      },
    },
    {
      method: 'GET',
      path: '/api/runs/:runId/result',
      purpose: "A finished run's detail from memory, for a result that was not saved",
      handler: (context) => {
        const runId = context.params.runId ?? '';
        const outcome = session.getResult(runId);
        if (!outcome) {
          throw notFound(`The result of run ${runId}`, 'Finished runs are kept for 15 minutes or until the next one.');
        }
        return aggregateResult(outcome.result, unsavedMeta(session, runId));
      },
    },
    {
      method: 'GET',
      path: '/api/runs/:runId/export',
      purpose: 'Download an unsaved run as a report',
      handler: (context) => {
        const runId = context.params.runId ?? '';
        const outcome = session.getResult(runId);
        if (!outcome) throw notFound(`The result of run ${runId}`);

        const format = context.query.get('format') ?? 'html';
        const formats = ['html', 'markdown', 'json', 'llm'];
        if (!formats.includes(format)) throw invalidOption('format', formats, format);

        const body =
          format === 'html'
            ? renderHtmlReport(outcome.result)
            : format === 'markdown'
              ? renderMarkdownReport(outcome.result)
              : format === 'llm'
                ? renderLlmReport(outcome.result)
                : JSON.stringify(outcome.result, null, 2);

        const extension = format === 'markdown' ? 'md' : format === 'llm' ? 'txt' : format;
        context.res.writeHead(200, {
          'Content-Type': 'application/octet-stream',
          'Content-Length': String(Buffer.byteLength(body)),
          'Content-Disposition': `attachment; filename="seo-report-${runId}.${extension}"`,
          'Cache-Control': 'no-store',
        });
        context.res.end(body);
        return HANDLED;
      },
    },
    {
      method: 'POST',
      path: '/api/runs/:runId/save',
      purpose: 'Store a finished run that could not be saved the first time',
      handler: (context) => {
        const runId = context.params.runId ?? '';
        try {
          const saved = session.persist(runId);
          if (!saved) {
            throw notFound(
              `An unsaved result for run ${runId}`,
              'It was already saved, or it is no longer retained.'
            );
          }
          return { auditId: saved.auditId, domain: saved.domain };
        } catch (error) {
          if (error instanceof ApiError) throw error;
          const message = error instanceof Error ? error.message : String(error);
          return new Responded(500, {
            error: { code: 'internal', message: `Saving failed again: ${message}`, hint: 'Run `seomator self doctor`.' },
          });
        }
      },
    },
    {
      method: 'GET',
      path: '/api/events',
      purpose: 'Live run progress as Server-Sent Events',
      handler: (context) => {
        events.add(context.res);
        return HANDLED;
      },
    },
  ];
}
