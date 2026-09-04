/**
 * The dashboard's read endpoints.
 *
 * Handlers are thin: they validate what came off the wire, call a shared
 * query, and return a value the router serializes. Anything that needs to
 * write its own response (an export download) returns `HANDLED`.
 */

import * as os from 'os';
import type { AuditsDatabase } from '../storage/audits-db/index.js';
import { getAuditsDbPath } from '../storage/paths.js';
import { getVersion } from '../version.js';
import { categories } from '../categories/index.js';
import { getRuleCount } from '../rules/registry.js';
import {
  renderHtmlReport,
  renderMarkdownReport,
  renderLlmReport,
} from '../reporters/index.js';
import { ApiError, invalidId, notFound } from './errors.js';
import { HANDLED, Responded, type RequestContext, type Route } from './server.js';
import {
  compareStored,
  getAuditDetail,
  getRulePages,
  getTrend,
  listAudits,
  listDomains,
} from './queries.js';
import type { Capabilities } from './audit-session.js';

/** Ids the CLI has ever generated: a date, then a short random suffix */
const AUDIT_ID = /^[0-9]{4}-[0-9]{2}-[0-9]{2}-[a-z0-9]{1,12}$/;

/** A page of results is capped so one request cannot pull the whole table */
const MAX_LIMIT = 200;

export interface ApiDependencies {
  db: () => AuditsDatabase;
  capabilities: Capabilities;
  /** When the server started, for uptime */
  startedAt: number;
  /** How this CLI was invoked, so the docs can show the right command */
  invocation: 'npx' | 'global';
  /** Every route, for the self-describing index */
  routes: () => Route[];
}

function auditIdParam(context: RequestContext): string {
  const id = context.params.id ?? '';
  if (!AUDIT_ID.test(id)) throw invalidId(id);
  return id;
}

/** Parse a bounded integer query parameter */
export function intParam(
  query: URLSearchParams,
  name: string,
  { min, max, fallback }: { min: number; max: number; fallback: number }
): number {
  const raw = query.get(name);
  if (raw === null || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    // No silent clamping: an agent's typo should fail loudly rather than
    // quietly return a different page of results than it asked for.
    throw new ApiError(400, 'invalid-option', `"${name}" must be an integer between ${min} and ${max}.`, {
      details: { option: name, allowed: `${min}–${max}`, received: raw },
    });
  }
  return value;
}

/** Render a home directory as `~` so a screenshot does not leak a username */
export function tildePath(absolute: string): string {
  const home = os.homedir();
  return absolute.startsWith(home) ? `~${absolute.slice(home.length)}` : absolute;
}

const EXPORT_FORMATS = ['html', 'markdown', 'json', 'llm'] as const;
type ExportFormat = (typeof EXPORT_FORMATS)[number];

const EXPORT_EXTENSIONS: Record<ExportFormat, string> = {
  html: 'html',
  markdown: 'md',
  json: 'json',
  llm: 'txt',
};

const EXPORT_TYPES: Record<ExportFormat, string> = {
  html: 'text/html; charset=utf-8',
  markdown: 'text/markdown; charset=utf-8',
  json: 'application/json; charset=utf-8',
  llm: 'text/plain; charset=utf-8',
};

function exportFormat(query: URLSearchParams): ExportFormat {
  const raw = query.get('format') ?? 'html';
  if (!(EXPORT_FORMATS as readonly string[]).includes(raw)) {
    throw new ApiError(400, 'invalid-option', `"${raw}" is not an export format.`, {
      details: { option: 'format', allowed: EXPORT_FORMATS },
    });
  }
  return raw as ExportFormat;
}

/** Build the read routes */
export function createReadRoutes(deps: ApiDependencies): Route[] {
  return [
    {
      method: 'GET',
      path: '/api',
      purpose: 'This route index',
      handler: () => ({
        name: 'SEOmator dashboard API',
        version: getVersion(),
        routes: deps
          .routes()
          .map((route) => ({ method: route.method, path: route.path, purpose: route.purpose }))
          .sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method)),
      }),
    },
    {
      method: 'GET',
      path: '/api/info',
      purpose: 'Build facts: version, rule and category counts, capabilities, database path',
      handler: () => ({
        version: getVersion(),
        ruleCount: getRuleCount(),
        categoryCount: categories.length,
        categories: categories.map((c) => ({ id: c.id, name: c.name, weight: c.weight })),
        dbPath: tildePath(getAuditsDbPath()),
        capabilities: deps.capabilities,
        invocation: deps.invocation,
        uptimeSeconds: Math.round((Date.now() - deps.startedAt) / 1000),
      }),
    },
    {
      method: 'GET',
      path: '/api/audits',
      purpose: 'List stored audits, newest first',
      handler: ({ query }) =>
        listAudits(deps.db(), {
          ...(query.get('domain') && { domain: query.get('domain')! }),
          ...(query.get('status') && { status: query.get('status')! as 'completed' }),
          limit: intParam(query, 'limit', { min: 1, max: MAX_LIMIT, fallback: 50 }),
          offset: intParam(query, 'offset', { min: 0, max: 1_000_000, fallback: 0 }),
        }),
    },
    {
      method: 'GET',
      path: '/api/audits/:id',
      purpose: 'One stored audit, aggregated to one row per rule',
      handler: (context) => {
        const detail = getAuditDetail(deps.db(), auditIdParam(context));
        if (!detail) throw notFound(`Audit ${context.params.id}`, 'GET /api/audits lists the stored audits.');
        return detail;
      },
    },
    {
      method: 'GET',
      path: '/api/audits/:id/rules/:ruleId/pages',
      purpose: 'Every page one rule ran on, for the per-rule drill-down',
      handler: (context) => {
        const id = auditIdParam(context);
        const result = getRulePages(deps.db(), id, context.params.ruleId ?? '', {
          limit: intParam(context.query, 'limit', { min: 1, max: MAX_LIMIT, fallback: 100 }),
          offset: intParam(context.query, 'offset', { min: 0, max: 1_000_000, fallback: 0 }),
        });
        if (!result) throw notFound(`Audit ${id}`);
        return result;
      },
    },
    {
      method: 'DELETE',
      path: '/api/audits/:id',
      purpose: 'Delete one stored audit and everything under it',
      handler: (context) => {
        const id = auditIdParam(context);
        if (!deps.db().deleteAudit(id)) throw notFound(`Audit ${id}`);
        return new Responded(204, undefined);
      },
    },
    {
      method: 'GET',
      path: '/api/audits/:id/export',
      purpose: 'Download an audit as html, markdown, json or llm text',
      handler: (context) => {
        const id = auditIdParam(context);
        const format = exportFormat(context.query);
        const detail = getAuditDetail(deps.db(), id);
        if (!detail) throw notFound(`Audit ${id}`);

        const body =
          format === 'html'
            ? renderHtmlReport(detail.result)
            : format === 'markdown'
              ? renderMarkdownReport(detail.result)
              : format === 'llm'
                ? renderLlmReport(detail.result)
                : JSON.stringify(detail, null, 2);

        // The filename is built from the validated id alone, so nothing a
        // caller sends can shape the Content-Disposition header.
        context.res.writeHead(200, {
          'Content-Type': EXPORT_TYPES[format],
          'Content-Length': String(Buffer.byteLength(body)),
          'Content-Disposition': `attachment; filename="seo-report-${id}.${EXPORT_EXTENSIONS[format]}"`,
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff',
        });
        context.res.end(body);
        return HANDLED;
      },
    },
    {
      method: 'GET',
      path: '/api/audits/:id/compare',
      purpose: 'Compare an audit with the one before it, or with ?against=<id>',
      handler: (context) => {
        const id = auditIdParam(context);
        const against = context.query.get('against');
        if (against !== null && !AUDIT_ID.test(against)) throw invalidId(against);

        const comparison = compareStored(deps.db(), id, against ?? undefined);
        if (!comparison) {
          if (!deps.db().getAudit(id)) throw notFound(`Audit ${id}`);
          throw notFound(
            `A previous audit of this domain`,
            'Run the audit again to have something to compare against.'
          );
        }
        return comparison;
      },
    },
    {
      method: 'GET',
      path: '/api/domains',
      purpose: 'One row per audited domain: latest score, movement, sparkline',
      handler: () => listDomains(deps.db()),
    },
    {
      method: 'GET',
      path: '/api/domains/:domain/trend',
      purpose: "A domain's score history, oldest first",
      handler: (context) =>
        getTrend(
          deps.db(),
          context.params.domain ?? '',
          intParam(context.query, 'limit', { min: 1, max: 100, fallback: 10 })
        ),
    },
  ];
}
