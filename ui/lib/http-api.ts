/**
 * The HTTP adapter: the same surface the Electron preload exposes, backed by
 * the dashboard's REST API.
 *
 * The renderer never learns which one it is talking to. That is the whole
 * point of the seam — one React app, two hosts.
 *
 * The token travels as an `HttpOnly` cookie the server set when it served this
 * page, so nothing here handles it; `credentials: 'same-origin'` is what makes
 * the browser send it.
 */

import type {
  AppInfoIpc,
  AuditDetail,
  AuditSummaryDto,
  DbListAuditsArgs,
  DbScoreTrendArgs,
  DomainSummary,
  ScoreTrendPointDto,
  StoredComparison,
} from '../../electron/shared/ipc-types.js';

/** What the API says when something goes wrong */
export interface ApiFailure {
  code: string;
  message: string;
  hint?: string;
  details?: Record<string, unknown>;
}

export class HttpApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly hint: string | undefined;

  constructor(status: number, failure: ApiFailure) {
    super(failure.message);
    this.name = 'HttpApiError';
    this.status = status;
    this.code = failure.code;
    this.hint = failure.hint;
  }
}

/** Raised when the server is not answering at all — it was stopped, usually */
export class ServerUnreachableError extends Error {
  constructor() {
    super('The dashboard server is not responding.');
    this.name = 'ServerUnreachableError';
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      credentials: 'same-origin',
      headers: { Accept: 'application/json', ...(init.headers ?? {}) },
    });
  } catch {
    // A network-level failure from a same-origin fetch means the server went
    // away: the CLI was stopped, or the machine slept. The UI says so rather
    // than showing an empty history.
    throw new ServerUnreachableError();
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  const body = text ? (JSON.parse(text) as unknown) : null;

  if (!response.ok) {
    const failure = (body as { error?: ApiFailure } | null)?.error;
    throw new HttpApiError(
      response.status,
      failure ?? { code: 'unknown', message: `Request failed with ${response.status}` }
    );
  }

  return body as T;
}

function queryString(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value));
  }
  const rendered = search.toString();
  return rendered ? `?${rendered}` : '';
}

/** The read half of the dashboard API, shaped like the Electron bridge */
export const httpApi = {
  listAudits: (args: DbListAuditsArgs = {}): Promise<AuditSummaryDto[]> =>
    request(`/api/audits${queryString({ domain: args.domain, limit: args.limit, offset: args.offset })}`),

  getAuditDetail: (auditId: string): Promise<AuditDetail | null> =>
    request<AuditDetail>(`/api/audits/${encodeURIComponent(auditId)}`).catch((error: unknown) => {
      if (error instanceof HttpApiError && error.status === 404) return null;
      throw error;
    }),

  getScoreTrend: (args: DbScoreTrendArgs): Promise<ScoreTrendPointDto[]> =>
    request(`/api/domains/${encodeURIComponent(args.domain)}/trend${queryString({ limit: args.limit })}`),

  listDomains: (): Promise<DomainSummary[]> => request('/api/domains'),

  getAuditedDomains: async (): Promise<string[]> =>
    (await httpApi.listDomains()).map((domain) => domain.domain),

  getAppInfo: (): Promise<AppInfoIpc> => request('/api/info'),

  compare: (auditId: string, against?: string): Promise<StoredComparison> =>
    request(`/api/audits/${encodeURIComponent(auditId)}/compare${queryString({ against })}`),

  deleteAudit: (auditId: string): Promise<void> =>
    request(`/api/audits/${encodeURIComponent(auditId)}`, { method: 'DELETE' }),

  /** Exports are a browser download, not a fetch — the server sets the filename */
  exportUrl: (auditId: string, format: 'html' | 'markdown' | 'json' | 'llm'): string =>
    `/api/audits/${encodeURIComponent(auditId)}/export?format=${format}`,
};

export type HttpApi = typeof httpApi;
