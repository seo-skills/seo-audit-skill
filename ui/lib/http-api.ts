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
  AuditRunArgs,
  RunState,
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

  /**
   * `failure` is whatever the response body carried, which is not always the
   * envelope this client expects: a reverse proxy's HTML 502, a truncated body,
   * a server of a different vintage. When `failure.message` came back undefined
   * the error was built as `Error('')`, and an empty string is falsy — so every
   * `if (error)` in the UI skipped, and a failed read rendered as an empty
   * database. An error must never be able to describe itself as nothing.
   */
  constructor(status: number, failure: Partial<ApiFailure> | null | undefined) {
    super(
      typeof failure?.message === 'string' && failure.message.trim() !== ''
        ? failure.message
        : `The server returned ${status}.`
    );
    this.name = 'HttpApiError';
    this.status = status;
    this.code = typeof failure?.code === 'string' ? failure.code : 'unknown';
    this.hint = failure?.hint;
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
  let body: unknown = null;
  try {
    body = text ? (JSON.parse(text) as unknown) : null;
  } catch {
    // An HTML error page from a proxy, say. Not JSON, not a reason to throw a
    // SyntaxError past the status check below and lose the status entirely.
    body = null;
  }

  if (!response.ok) {
    // Only an object-shaped `error` is the envelope; a bare string or a missing
    // one lets HttpApiError fall back to a message derived from the status.
    const raw = (body as { error?: unknown } | null)?.error;
    const failure =
      raw !== null && typeof raw === 'object' ? (raw as Partial<ApiFailure>) : undefined;
    throw new HttpApiError(response.status, failure);
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

/** Starting, watching and cancelling a run over HTTP */
export const httpRuns = {
  start: async (args: AuditRunArgs): Promise<{ runId: string; run: RunState }> =>
    request('/api/runs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    }),

  cancel: async (): Promise<void> => {
    await request('/api/runs/current', { method: 'DELETE' });
  },

  getState: async (): Promise<RunState | null> => {
    const { run } = await request<{ run: RunState | null }>('/api/runs/current');
    return run;
  },

  /** A finished run's detail, for a result the server could not store */
  getResult: (runId: string) => request<unknown>(`/api/runs/${encodeURIComponent(runId)}/result`),

  retrySave: (runId: string): Promise<{ auditId: string }> =>
    request(`/api/runs/${encodeURIComponent(runId)}/save`, { method: 'POST' }),

  exportUrl: (runId: string, format: string): string =>
    `/api/runs/${encodeURIComponent(runId)}/export?format=${format}`,
};

/**
 * Watch the run over Server-Sent Events, one stream per *visible* tab.
 *
 * Node's http is HTTP/1.1 and browsers allow six connections per host, so a
 * few background tabs each holding a stream would starve the dashboard's own
 * fetches. A hidden tab closes its stream; a tab that comes back opens one and
 * gets a fresh snapshot, which is why no replay buffer is needed.
 *
 * @param onState - Called with every state, including the snapshot on connect
 * @returns Unsubscribe
 */
export function subscribeToRun(
  onState: (state: RunState) => void,
  primitives: {
    EventSource?: typeof globalThis.EventSource;
    document?: Pick<Document, 'addEventListener' | 'removeEventListener' | 'visibilityState'>;
  } = {}
): () => void {
  const Source = primitives.EventSource ?? globalThis.EventSource;
  const doc = primitives.document ?? globalThis.document;
  if (!Source || !doc) return () => {};

  let source: EventSource | null = null;

  const open = (): void => {
    if (source) return;
    source = new Source('/api/events', { withCredentials: true });
    const handle = (event: MessageEvent): void => {
      try {
        onState(JSON.parse(event.data) as RunState);
      } catch {
        // A malformed frame is not worth tearing the stream down for.
      }
    };
    // `snapshot` on connect, `state` on every change; both carry a RunState.
    source.addEventListener('snapshot', handle as EventListener);
    source.addEventListener('state', handle as EventListener);
    // `error` is EventSource's transport event; it reconnects on its own, so
    // there is nothing to do here but let it.
  };

  const close = (): void => {
    source?.close();
    source = null;
  };

  const onVisibility = (): void => {
    if (doc.visibilityState === 'hidden') close();
    else open();
  };

  doc.addEventListener('visibilitychange', onVisibility);
  if (doc.visibilityState !== 'hidden') open();

  return () => {
    doc.removeEventListener('visibilitychange', onVisibility);
    close();
  };
}
