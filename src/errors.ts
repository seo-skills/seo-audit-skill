/**
 * Typed failures for an audit run.
 *
 * Every surface that runs an audit (CLI, desktop app, dashboard) needs to
 * tell the user what went wrong in a way they can act on: "the browser is not
 * installed" calls for a different next step than "the site did not answer".
 * The code carries that distinction across process and transport boundaries;
 * the hint says what to do about it.
 */

import { findPrivateAddressError } from './net/fetch.js';

export type AuditErrorCode =
  | 'dns'
  | 'unreachable'
  | 'tls'
  | 'timeout'
  | 'non-html'
  | 'http-error'
  | 'playwright-missing'
  | 'no-pages'
  | 'config'
  | 'private-address'
  | 'rate-limited'
  | 'crawl-too-slow'
  | 'busy'
  | 'run-not-found'
  | 'aborted'
  | 'unknown';

const HINTS: Partial<Record<AuditErrorCode, string>> = {
  dns: 'Check the hostname for typos and that you are online.',
  unreachable: 'Nothing answered at that address. Check the URL and port, that the site is running, and any firewall or proxy in between.',
  tls: 'The HTTPS certificate was rejected. Check it is valid for this hostname and not expired, or audit the http:// URL if the site has no certificate.',
  timeout: 'Try again, raise --timeout, or audit without --crawl.',
  'non-html': 'Point the audit at an HTML page rather than a file, API or feed.',
  'http-error': 'Make sure the URL is publicly reachable and returns 200.',
  config: 'Check the --config path, or drop the flag to search for seomator.toml.',
  'rate-limited':
    'Try again later, lower --concurrency to 1, or set crawler.per_host_delay_ms (for example 2000) to space requests out.',
  'crawl-too-slow':
    "The site's Crawl-delay makes this crawl longer than allowed. Crawl fewer pages, raise the duration limit, or skip the Crawl-delay.",
  'private-address':
    'The address is loopback, private or link-local. From the CLI, dashboard or desktop app, a local or intranet site and the private hosts its start page redirects to are audited; other private hosts its pages point to are refused. Over MCP, every private host the run needs must be allowed: `seomator mcp --allow-private`, or one `--allow-host <host:port>` per host.',
  'playwright-missing': 'Run `npx playwright install chromium`, or audit without --cwv to skip the browser render.',
  'no-pages': 'The crawl found nothing to audit. Check robots.txt, the include/exclude patterns and that the start URL links to other pages.',
};

export class AuditError extends Error {
  readonly code: AuditErrorCode;
  /** What the user can do about it, when there is something */
  readonly hint: string | undefined;

  constructor(code: AuditErrorCode, message: string, options: { cause?: unknown; hint?: string } = {}) {
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = 'AuditError';
    this.code = code;
    this.hint = options.hint ?? HINTS[code];
  }
}

/** The run was cancelled on purpose; nothing is wrong. */
export class AuditAbortedError extends AuditError {
  constructor(message = 'Audit cancelled') {
    super('aborted', message);
    this.name = 'AuditAbortedError';
  }
}

/**
 * Whether an error came from an AbortSignal, ours or the platform's.
 *
 * `fetch` rejects with a DOMException named AbortError; `AbortSignal.timeout`
 * with one named TimeoutError, which is not a cancellation. Node's own APIs
 * use the ABORT_ERR code.
 */
export function isAbortError(error: unknown): boolean {
  if (error instanceof AuditAbortedError) return true;
  if (typeof error !== 'object' || error === null) return false;
  const { name, code } = error as { name?: unknown; code?: unknown };
  return name === 'AbortError' || code === 'ABORT_ERR';
}

/**
 * Throw the cancellation error when the signal has fired.
 *
 * Used at the top of every step that would otherwise start new work, so a
 * cancelled run stops at the next boundary instead of the next network error.
 */
export function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new AuditAbortedError();
}

/**
 * Wait `ms`, or until any of `signals` fires, whichever comes first.
 *
 * Resolves either way; the caller checks its signals after. A plain timer
 * cannot be cancelled, and a Retry-After wait can last minutes, so a run
 * cancelled during one would otherwise hold its slot until the wait ended.
 */
export function waitUnlessAborted(ms: number, ...signals: Array<AbortSignal | undefined>): Promise<void> {
  const live = signals.filter((signal): signal is AbortSignal => signal !== undefined);
  if (ms <= 0 || live.some((signal) => signal.aborted)) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer);
      for (const signal of live) signal.removeEventListener('abort', done);
      resolve();
    };
    const timer = setTimeout(done, ms);
    for (const signal of live) signal.addEventListener('abort', done, { once: true });
  });
}

/**
 * Re-raise a caught error as a cancellation when the run was cancelled.
 *
 * Catch blocks that turn network failures into "unmeasured" results call this
 * first: a cancelled fetch looks like a network failure, and swallowing it
 * would let the run carry on to the next page as if nothing had happened.
 *
 * Only the caller's own signal counts. A bare `AbortError` also comes from
 * every per-request timeout, and treating those as cancellations would turn a
 * slow link check into an aborted audit.
 */
export function rethrowIfAborted(error: unknown, signal?: AbortSignal): void {
  if (error instanceof AuditAbortedError) throw error;
  if (signal?.aborted) throw new AuditAbortedError();
}

/**
 * Classify any thrown value as an `AuditError` for display.
 *
 * Already-typed errors pass through. Everything else is matched on the shapes
 * Node, undici and Playwright actually produce.
 */
export function classifyError(error: unknown): AuditError {
  if (error instanceof AuditError) return error;

  const message = error instanceof Error ? error.message : String(error);
  const cause = error instanceof Error ? (error.cause as { code?: string; message?: string } | undefined) : undefined;
  const causeCode = cause?.code ?? '';
  const text = `${message} ${causeCode}`;

  if (isAbortError(error)) return new AuditAbortedError();

  // A refusal by the network policy rides inside fetch's "fetch failed" as a
  // cause; name it, or it reads as an unreachable site.
  const refused = findPrivateAddressError(error);
  if (refused) {
    return new AuditError('private-address', refused.message, { cause: error });
  }

  if (/ENOTFOUND|EAI_AGAIN|getaddrinfo/i.test(text)) {
    return new AuditError('dns', `Could not resolve the hostname: ${message}`, { cause: error });
  }
  if (/ECONNREFUSED|ECONNRESET|EHOSTUNREACH|ENETUNREACH|EPIPE|UND_ERR_SOCKET/.test(causeCode)) {
    return new AuditError('unreachable', `Could not connect to the site (${causeCode}): ${cause?.message ?? message}`, {
      cause: error,
    });
  }
  if (/CERT|SELF_SIGNED|UNABLE_TO_VERIFY|ERR_TLS|ERR_SSL/.test(causeCode)) {
    return new AuditError('tls', `The site's TLS certificate was rejected (${causeCode})`, { cause: error });
  }
  if (/TimeoutError|timed out|timeout|ETIMEDOUT|UND_ERR_CONNECT_TIMEOUT|UND_ERR_HEADERS_TIMEOUT/i.test(text)) {
    return new AuditError('timeout', `The site did not respond in time: ${message}`, { cause: error });
  }
  if (/Executable doesn't exist|browserType\.launch|playwright install|Failed to launch/i.test(text)) {
    return new AuditError('playwright-missing', `The browser could not be started: ${message}`, { cause: error });
  }
  return new AuditError('unknown', message, { cause: error });
}
