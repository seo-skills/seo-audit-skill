/**
 * One place per audit run that requests URLs other than the pages themselves:
 * links, images, PDFs, probes, redirect targets.
 *
 * Pages share most of these URLs (a footer link sits on every page), and
 * rules share some (two rules ask for the same canonical target). Each
 * distinct request is made once per run: concurrent askers wait on the same
 * promise, later ones get the answer from memory. External link statuses that
 * are settled facts also persist across runs in the link cache.
 */
import { netFetch, findPrivateAddressError, readBodyCapped, readBytesPrefix, MAX_PAGE_BYTES } from './fetch.js';
import { requestSignal } from '../crawler/fetcher.js';
import { getUserAgent } from '../crawler/user-agent.js';
import { MAX_RATE_LIMIT_RETRIES, parseRetryAfter } from '../crawler/crawler.js';
import { throwIfAborted } from '../errors.js';

/**
 * What a status means for a link to another site.
 *
 * Only `broken` is reported as broken. `blocked` (the server refused this
 * client) and `unknown` (no answer in time) are "could not verify": a bot
 * wall or a slow host says nothing about whether visitors can reach the page.
 */
export type UrlVerdict = 'ok' | 'broken' | 'blocked' | 'unknown';

/** Why a request got no HTTP status */
export type UrlFailure = 'timeout' | 'dns' | 'refused' | 'network' | 'private-address' | 'too-large';

export interface UrlRequest {
  /** Omit for a status check: HEAD, confirmed with GET when HEAD fails */
  method?: 'HEAD' | 'GET';
  /** `false` returns the first response, with its `location` (default: follow) */
  followRedirects?: boolean;
  /** Extra request headers; part of the memo key */
  headers?: Record<string, string>;
  /** Read the first n bytes of the body (a ranged GET), or `'all'` of it */
  needBytes?: number | 'all';
}

export interface UrlInfo {
  url: string;
  /** HTTP status, or 0 when there was no response (see `failure`) */
  status: number;
  /** The response headers rules read: x-robots-tag, link, content-*, location */
  headers: Record<string, string>;
  contentType: string | null;
  /** Full size: Content-Length, or the total of a Content-Range */
  contentLength: number | null;
  finalUrl: string;
  location?: string;
  bytes?: Uint8Array;
  verdict: UrlVerdict;
  /** Still 429 or 503 after the retries: could not verify, never broken */
  rateLimited?: boolean;
  failure?: UrlFailure;
  /** Answered from the persisted link cache, not the network */
  cached?: boolean;
}

/** The persisted half: `LinkCache` satisfies it */
export interface StatusCache {
  get(url: string): { statusCode: number; isValid: boolean } | null;
  set(url: string, statusCode: number, error?: string): void;
}

export interface UrlServiceOptions {
  /** The audited site; any other host is external */
  siteUrl?: string;
  /** Per request, in milliseconds (default 10000) */
  timeoutMs?: number;
  /** Requests in flight across all hosts (default 5) */
  concurrency?: number;
  /** Requests in flight to one host (default 2) */
  perHostConcurrency?: number;
  /** Where settled external statuses persist between runs */
  cache?: StatusCache | null;
  /** Ignore what the cache holds; still write fresh answers to it */
  refresh?: boolean;
  signal?: AbortSignal;
  /** Longest single wait on a Retry-After (default 120000) */
  maxRetryAfterMs?: number;
  /** First backoff when a 429 or 503 has no Retry-After (default 5000) */
  backoffBaseMs?: number;
}

/** Headers kept on a `UrlInfo` */
const KEPT_HEADERS = ['x-robots-tag', 'link', 'content-type', 'content-length', 'content-range', 'location'];

/** Statuses that say a link's target is gone, as opposed to refused or slow */
const GONE_STATUSES = new Set([404, 410]);

/** Classify a finished request. Exported for the tests. */
export function verdictFor(status: number, failure?: UrlFailure): UrlVerdict {
  if (status === 0) {
    if (failure === 'dns' || failure === 'refused') return 'broken';
    if (failure === 'private-address') return 'blocked';
    return 'unknown';
  }
  if (status < 400) return 'ok';
  if (GONE_STATUSES.has(status)) return 'broken';
  if (status >= 500 && status <= 599 && status !== 503) return 'broken';
  // 401, 403, 429, 503 after retries, 999 and the other 4xx: the server
  // refused this client, which says nothing about a visitor
  return 'blocked';
}

/** A request's failure reason, from the error fetch threw */
function failureOf(error: unknown, timedOut: boolean): UrlFailure {
  if (timedOut) return 'timeout';
  if (findPrivateAddressError(error)) return 'private-address';
  const code = (error as { cause?: { code?: string } })?.cause?.code;
  if (code === 'ENOTFOUND') return 'dns';
  if (code === 'ECONNREFUSED') return 'refused';
  if ((error as Error)?.name === 'BodyTooLargeError') return 'too-large';
  return 'network';
}

/** A FIFO counting semaphore */
class Slots {
  private waiting: Array<() => void> = [];
  constructor(private free: number) {}

  async take(): Promise<void> {
    if (this.free > 0) {
      this.free--;
      return;
    }
    await new Promise<void>((resolve) => this.waiting.push(resolve));
  }

  give(): void {
    const next = this.waiting.shift();
    if (next) next();
    else this.free++;
  }
}

/**
 * The caller's own signal stopped the request (a budget ran out). Distinct
 * from a cancelled run, which throws `AuditAbortedError`.
 */
export class RequestAbandonedError extends Error {
  constructor() {
    super('Request abandoned by its caller');
    this.name = 'RequestAbandonedError';
  }
}

function throwIfAbandoned(signal?: AbortSignal): void {
  if (signal?.aborted) throw new RequestAbandonedError();
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class UrlService {
  private readonly memo = new Map<string, Promise<UrlInfo>>();
  private readonly global: Slots;
  private readonly hosts = new Map<string, Slots>();
  private readonly pausedUntil = new Map<string, number>();
  private readonly siteHost: string | null;
  private readonly timeoutMs: number;
  private readonly perHost: number;
  private readonly maxRetryAfterMs: number;
  private readonly backoffBaseMs: number;
  /** Network requests sent, HEAD and GET counted separately */
  requestCount = 0;
  private closed = false;

  constructor(private readonly options: UrlServiceOptions = {}) {
    this.siteHost = options.siteUrl ? new URL(options.siteUrl).hostname : null;
    this.timeoutMs = options.timeoutMs ?? 10000;
    this.global = new Slots(options.concurrency ?? 5);
    this.perHost = options.perHostConcurrency ?? 2;
    this.maxRetryAfterMs = options.maxRetryAfterMs ?? 120000;
    this.backoffBaseMs = options.backoffBaseMs ?? 5000;
  }

  /**
   * Stop using the link cache: the run is over and its owner may close it.
   * The service still answers from memory.
   */
  close(): void {
    this.closed = true;
  }

  /** Whether a URL is on a different host from the audited site */
  isExternal(url: string): boolean {
    return this.siteHost !== null && new URL(url).hostname !== this.siteHost;
  }

  /** A status check: HEAD, confirmed with GET when HEAD fails */
  status(url: string, signal?: AbortSignal): Promise<UrlInfo> {
    return this.get(url, {}, signal);
  }

  /**
   * Request a URL once per run, whoever asks.
   *
   * `signal` lets one caller stop waiting (a budget running out) without
   * cancelling the run. A request it aborted is forgotten, so a later caller
   * asks again rather than inheriting the abort.
   */
  get(url: string, request: UrlRequest = {}, signal?: AbortSignal): Promise<UrlInfo> {
    const key = memoKey(url, request);
    const known = this.memo.get(key);
    if (known) return known;
    const pending = this.load(url, request, signal);
    this.memo.set(key, pending);
    pending.catch(() => this.memo.delete(key));
    return pending;
  }

  /** Whether the persisted cache may answer for, and store, this request */
  private persists(url: string, request: UrlRequest): boolean {
    return (
      !this.closed &&
      !!this.options.cache &&
      request.method === undefined &&
      request.followRedirects !== false &&
      request.headers === undefined &&
      request.needBytes === undefined &&
      this.isExternal(url)
    );
  }

  private async load(url: string, request: UrlRequest, signal?: AbortSignal): Promise<UrlInfo> {
    const persists = this.persists(url, request);
    if (persists && !this.options.refresh) {
      const hit = this.options.cache!.get(url);
      if (hit?.isValid) {
        const verdict = verdictFor(hit.statusCode);
        // Only settled answers are stored; anything else is asked again
        if (verdict === 'ok' || GONE_STATUSES.has(hit.statusCode)) {
          return { url, status: hit.statusCode, headers: {}, contentType: null, contentLength: null, finalUrl: url, verdict, cached: true };
        }
      }
    }

    const info = await this.withRateLimitRetries(url, request, signal);
    // A 5xx or DNS failure can be a short outage: remembered for this run
    // only, so it does not read as broken for the cache's whole lifetime.
    if (persists && !this.closed && (info.verdict === 'ok' || GONE_STATUSES.has(info.status))) {
      this.options.cache!.set(url, info.status);
    }
    return info;
  }

  /** Ask again while the host answers 429 or 503, as a crawl does */
  private async withRateLimitRetries(url: string, request: UrlRequest, signal?: AbortSignal): Promise<UrlInfo> {
    const host = new URL(url).host;
    for (let attempt = 1; ; attempt++) {
      const info = await this.limited(host, () => this.attempt(url, request, signal), signal);
      if (info.status !== 429 && info.status !== 503) return info;
      if (attempt > MAX_RATE_LIMIT_RETRIES) return { ...info, rateLimited: true, verdict: 'blocked' };
      const requested = parseRetryAfter(info.headers['retry-after']);
      const wait = Math.min(requested ?? this.backoffBaseMs * 2 ** (attempt - 1), this.maxRetryAfterMs);
      this.pausedUntil.set(host, Math.max(this.pausedUntil.get(host) ?? 0, Date.now() + wait));
    }
  }

  /** Run one request inside the global and per-host limits */
  private async limited<T>(host: string, run: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    let slots = this.hosts.get(host);
    if (!slots) {
      slots = new Slots(this.perHost);
      this.hosts.set(host, slots);
    }
    await slots.take();
    try {
      await this.global.take();
      try {
        const paused = (this.pausedUntil.get(host) ?? 0) - Date.now();
        if (paused > 0) await sleep(paused);
        throwIfAborted(this.options.signal);
        throwIfAbandoned(signal);
        return await run();
      } finally {
        this.global.give();
      }
    } finally {
      slots.give();
    }
  }

  /** One status check or one plain request, without rate-limit retries */
  private async attempt(url: string, request: UrlRequest, signal?: AbortSignal): Promise<UrlInfo> {
    if (request.method === undefined && request.needBytes === undefined) {
      const head = await this.send(url, { ...request, method: 'HEAD' }, signal);
      if (head.status !== 0 && head.status < 400) return head;
      const get = await this.send(url, { ...request, method: 'GET' }, signal);
      return get.status === 0 ? head : get;
    }
    return this.send(url, request, signal);
  }

  private async send(url: string, request: UrlRequest, signal?: AbortSignal): Promise<UrlInfo> {
    const signals = [this.options.signal, signal].filter((s): s is AbortSignal => !!s);
    const timer = requestSignal(this.timeoutMs, signals.length ? AbortSignal.any(signals) : undefined);
    const method = request.needBytes !== undefined ? 'GET' : (request.method ?? 'GET');
    const headers: Record<string, string> = { 'User-Agent': getUserAgent(), ...request.headers };
    if (typeof request.needBytes === 'number') headers['Range'] = `bytes=0-${request.needBytes - 1}`;
    this.requestCount++;
    try {
      const response = await netFetch(url, {
        method,
        headers,
        redirect: request.followRedirects === false ? 'manual' : 'follow',
        signal: timer.signal,
      });
      const kept: Record<string, string> = {};
      for (const name of [...KEPT_HEADERS, 'retry-after']) {
        const value = response.headers.get(name);
        if (value !== null) kept[name] = value;
      }
      let bytes: Uint8Array | undefined;
      if (request.needBytes === 'all') bytes = await readBodyCapped(response, MAX_PAGE_BYTES);
      else if (typeof request.needBytes === 'number') bytes = await readBytesPrefix(response, request.needBytes);
      else await response.body?.cancel().catch(() => {});
      return {
        url,
        status: response.status,
        headers: kept,
        contentType: kept['content-type'] ?? null,
        contentLength: fullLength(kept),
        finalUrl: response.url || url,
        ...(kept['location'] && { location: new URL(kept['location'], url).href }),
        ...(bytes && { bytes }),
        verdict: verdictFor(response.status),
      };
    } catch (error) {
      throwIfAborted(this.options.signal);
      throwIfAbandoned(signal);
      const failure = failureOf(error, timer.timedOut());
      return { url, status: 0, headers: {}, contentType: null, contentLength: null, finalUrl: url, verdict: verdictFor(0, failure), failure };
    } finally {
      timer.dispose();
    }
  }
}

/** Content-Length, or the total after the slash of a Content-Range */
function fullLength(headers: Record<string, string>): number | null {
  const range = headers['content-range']?.match(/\/(\d+)\s*$/);
  if (range) return Number(range[1]);
  const length = Number(headers['content-length']);
  return headers['content-length'] !== undefined && Number.isFinite(length) ? length : null;
}

function memoKey(url: string, request: UrlRequest): string {
  const headers = request.headers
    ? Object.entries(request.headers)
        .map(([k, v]) => [k.toLowerCase(), v])
        .sort(([a], [b]) => a.localeCompare(b))
    : [];
  return JSON.stringify([url, request.method ?? 'STATUS', request.followRedirects !== false, headers, request.needBytes ?? null]);
}

/**
 * The run's service, or a fresh one for a rule called on its own (tests,
 * library callers), which then behaves as the rule always did: uncached.
 */
export function urlServiceFor(context: { url: string; urls?: UrlService; signal?: AbortSignal }): UrlService {
  return context.urls ?? new UrlService({ siteUrl: context.url, ...(context.signal && { signal: context.signal }) });
}
