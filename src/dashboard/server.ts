/**
 * The dashboard's HTTP server.
 *
 * Node's built-in `http`, a table-driven router, and about as much security as
 * a loopback server needs — which is more than "it's only localhost" suggests.
 * Loopback is reachable from sandboxes, forwarded ports and host-network
 * containers, so every `/api` request must carry the per-launch token, and
 * every request is checked for cross-origin abuse on top of that.
 */

import * as http from 'http';
import { randomBytes } from 'crypto';
import { URL } from 'url';
import { ApiError, badOrigin, unauthorized, type ApiErrorBody } from './errors.js';
import { findWebAssets, serveStatic, type StaticAssets } from './static.js';

/** The cookie the browser carries; the header is for agents and curl */
export const TOKEN_COOKIE = 'seomator_token';
export const TOKEN_HEADER = 'x-seomator-token';

/** What every handler receives */
export interface RequestContext {
  req: http.IncomingMessage;
  res: http.ServerResponse;
  url: URL;
  /** Path parameters captured by the route pattern */
  params: Record<string, string>;
  /** Query string, already parsed */
  query: URLSearchParams;
}

/** A handler returns the value to serialize, or handles the response itself */
export type RouteHandler = (context: RequestContext) => unknown | Promise<unknown>;

export interface Route {
  method: 'GET' | 'POST' | 'DELETE';
  /** `/api/audits/:id` — `:name` captures one path segment */
  path: string;
  /** One line, shown in the `GET /api` index */
  purpose: string;
  handler: RouteHandler;
}

/** Marks a response the handler has already written (exports, SSE) */
export const HANDLED = Symbol('handled');

/** A response with a status other than 200 */
export class Responded {
  constructor(
    readonly status: number,
    readonly body: unknown,
    readonly headers: Record<string, string> = {}
  ) {}
}

interface CompiledRoute extends Route {
  pattern: RegExp;
  paramNames: string[];
}

/** Turn `/api/audits/:id/rules/:ruleId/pages` into a matcher */
function compile(route: Route): CompiledRoute {
  const paramNames: string[] = [];
  const pattern = route.path
    .split('/')
    .map((segment) => {
      if (!segment.startsWith(':')) return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      paramNames.push(segment.slice(1));
      return '([^/]+)';
    })
    .join('/');
  return { ...route, paramNames, pattern: new RegExp(`^${pattern}/?$`) };
}

export interface ServerOptions {
  routes: Route[];
  /** Where the built dashboard lives; absent means API-only */
  distDir?: string;
  /** Per-launch token every /api request must present */
  token: string;
  /**
   * Only used when a request arrives without a local port on its socket. The
   * Host check reads the real port from the connection, so `--port 0` works.
   */
  port?: number;
  /** Log one line per request */
  verbose?: boolean;
  /** Injectable for tests */
  log?: (line: string) => void;
}

/** Hostnames a loopback dashboard may be addressed by */
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]', '::1']);

/**
 * Check the request came from the dashboard itself.
 *
 * `Host` must be loopback, an `Origin` (if present) must be this server, and
 * `Sec-Fetch-Site` (if present) must say same-origin. Together these stop a
 * web page the user happens to have open from driving the dashboard, which
 * matters because the API can delete history and start audits.
 */
export function checkOrigin(
  headers: http.IncomingHttpHeaders,
  port: number
): { ok: true } | { ok: false; details: Record<string, unknown> } {
  const host = headers.host ?? '';
  const hostname = host.replace(/:\d+$/, '');
  const hasPort = /:\d+$/.test(host);

  if (!LOOPBACK_HOSTS.has(hostname)) {
    return { ok: false, details: { rejectedHost: host, allowedHosts: [...LOOPBACK_HOSTS] } };
  }
  // A Host without a port is only plausible for the default port
  if (hasPort && !host.endsWith(`:${port}`)) {
    return { ok: false, details: { rejectedHost: host, expectedPort: port } };
  }

  const origin = headers.origin;
  if (origin !== undefined && origin !== 'null') {
    const allowed = [...LOOPBACK_HOSTS].map((h) => `http://${h}:${port}`);
    if (!allowed.includes(origin)) {
      return { ok: false, details: { rejectedOrigin: origin, allowedOrigins: allowed } };
    }
  }

  const site = headers['sec-fetch-site'];
  if (typeof site === 'string' && site !== 'same-origin' && site !== 'none') {
    return { ok: false, details: { rejectedSecFetchSite: site } };
  }

  return { ok: true };
}

/** Read the token from the header or the cookie */
export function readToken(headers: http.IncomingHttpHeaders): string | null {
  const header = headers[TOKEN_HEADER];
  if (typeof header === 'string' && header.length > 0) return header;

  const cookie = headers.cookie;
  if (typeof cookie !== 'string') return null;
  for (const part of cookie.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === TOKEN_COOKIE) return rest.join('=');
  }
  return null;
}

/** Compare in constant time, so the token cannot be guessed byte by byte */
export function tokensMatch(provided: string | null, expected: string): boolean {
  if (provided === null || provided.length !== expected.length) return false;
  let difference = 0;
  for (let i = 0; i < provided.length; i++) {
    difference |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return difference === 0;
}

/** A fresh per-launch token */
export function generateToken(): string {
  return randomBytes(32).toString('base64url');
}

/** Headers every response carrying index.html sends */
export function documentHeaders(token: string): Record<string, string> {
  return {
    'X-Frame-Options': 'DENY',
    'Content-Security-Policy':
      "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'",
    // The browser and its EventSource carry this automatically; SameSite=Strict
    // means no other site can make the browser send it.
    'Set-Cookie': `${TOKEN_COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/`,
  };
}

/** Framing a dashboard would let a page overlay Delete or Run */
function isFramedRequest(headers: http.IncomingHttpHeaders): boolean {
  const dest = headers['sec-fetch-dest'];
  return dest === 'iframe' || dest === 'embed' || dest === 'object' || dest === 'frame';
}

export interface DashboardServer {
  server: http.Server;
  /** Routes, for the `GET /api` index and for tests */
  routes: Route[];
}

/**
 * Build the server. Call `.listen()` on the result.
 */
export function createServer(options: ServerOptions): DashboardServer {
  // Compiled once, up front: passing an array that is filled in later would
  // leave the router matching nothing, and every request would 404.
  if (options.routes.length === 0) {
    throw new Error('createServer() needs its routes; the table was empty.');
  }
  const compiled = options.routes.map(compile);
  const assets: StaticAssets = options.distDir
    ? findWebAssets(options.distDir)
    : { root: '', available: false };
  const log = options.log ?? ((line: string) => console.log(line));

  const server = http.createServer((req, res) => {
    const started = Date.now();
    void handle(req, res).finally(() => {
      if (options.verbose) {
        log(`  ${req.method} ${req.url} → ${res.statusCode} (${Date.now() - started}ms)`);
      }
    });
  });

  async function handle(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    let url: URL;
    try {
      url = new URL(req.url ?? '/', `http://${req.headers.host ?? '127.0.0.1'}`);
    } catch {
      sendError(res, new ApiError(400, 'unknown-route', 'The request URL could not be parsed.'));
      return;
    }

    const isApi = url.pathname === '/api' || url.pathname.startsWith('/api/');

    try {
      if (isFramedRequest(req.headers)) {
        throw badOrigin({ rejectedSecFetchDest: req.headers['sec-fetch-dest'] });
      }

      // The port the connection actually arrived on, not the one requested:
      // `--port 0` binds a free port, and comparing Host against 0 rejected
      // every request.
      const port = req.socket.localPort ?? options.port ?? 0;
      const origin = checkOrigin(req.headers, port);
      if (!origin.ok) throw badOrigin(origin.details);

      if (!isApi) {
        if (serveStatic(assets, url.pathname, res, { documentHeaders: () => documentHeaders(options.token) })) {
          return;
        }
        // No build present: say so rather than 404, which reads as a bug.
        res.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
        res.end(
          'The dashboard UI is not built in this install.\nRun `npm run build`, or use the API directly at /api.\n'
        );
        return;
      }

      if (!tokensMatch(readToken(req.headers), options.token)) throw unauthorized();

      const match = matchRoute(compiled, req.method ?? 'GET', url.pathname);
      if (match === 'method') {
        throw new ApiError(405, 'method-not-allowed', `${req.method} is not allowed on ${url.pathname}.`, {
          hint: 'GET /api lists every route and its method.',
        });
      }
      if (match === null) {
        throw new ApiError(404, 'unknown-route', `No route matches ${url.pathname}.`, {
          hint: 'GET /api lists the routes.',
        });
      }

      const result = await match.route.handler({
        req,
        res,
        url,
        params: match.params,
        query: url.searchParams,
      });

      if (result === HANDLED) return;
      if (result instanceof Responded) {
        sendJson(res, result.status, result.body, result.headers);
        return;
      }
      sendJson(res, 200, result);
    } catch (error) {
      if (error instanceof ApiError) {
        sendError(res, error);
        return;
      }
      // An unexpected throw is a bug: log it in full, but never leak a stack
      // trace or a filesystem path to the client.
      console.error('  Dashboard request failed:', error);
      sendError(
        res,
        new ApiError(500, 'internal', 'The dashboard hit an unexpected error handling this request.', {
          hint: 'The server log has the details.',
        })
      );
    }
  }

  return { server, routes: options.routes };
}

/** Find the route for a method and path, distinguishing "wrong method" from "no such path" */
export function matchRoute(
  routes: CompiledRoute[],
  method: string,
  pathname: string
): { route: CompiledRoute; params: Record<string, string> } | 'method' | null {
  let pathMatched = false;
  for (const route of routes) {
    const match = route.pattern.exec(pathname);
    if (!match) continue;
    pathMatched = true;
    if (route.method !== method) continue;

    const params: Record<string, string> = {};
    route.paramNames.forEach((name, index) => {
      params[name] = decodeURIComponent(match[index + 1]!);
    });
    return { route, params };
  }
  return pathMatched ? 'method' : null;
}

/** JSON, with the headers every API response carries */
export function sendJson(
  res: http.ServerResponse,
  status: number,
  body: unknown,
  headers: Record<string, string> = {}
): void {
  const payload = body === undefined ? '' : JSON.stringify(body);
  res.writeHead(status, {
    ...(payload ? { 'Content-Type': 'application/json; charset=utf-8' } : {}),
    'Content-Length': String(Buffer.byteLength(payload)),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    ...headers,
  });
  res.end(payload);
}

function sendError(res: http.ServerResponse, error: ApiError): void {
  const body: ApiErrorBody = error.toBody();
  sendJson(res, error.status, body, error.headers ?? {});
}

/**
 * Read a JSON request body.
 *
 * Capped, and parsed into a null-prototype object so a `__proto__` key in the
 * payload cannot reach `Object.prototype`.
 */
export async function readJsonBody(
  req: http.IncomingMessage,
  maxBytes = 64 * 1024
): Promise<Record<string, unknown>> {
  const type = (req.headers['content-type'] ?? '').split(';')[0]!.trim().toLowerCase();
  if (type !== 'application/json') {
    throw new ApiError(415, 'unsupported-media-type', `Expected application/json, got "${type || 'nothing'}".`, {
      hint: 'Send Content-Type: application/json.',
    });
  }

  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > maxBytes) {
      throw new ApiError(413, 'payload-too-large', `The request body is larger than ${maxBytes} bytes.`, {
        hint: 'Audit options are a small object; check the request body.',
      });
    }
    chunks.push(chunk as Buffer);
  }

  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (raw === '') return Object.create(null) as Record<string, unknown>;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw, function reviver(key, value) {
      // Drop the two keys that can reach Object.prototype through assignment.
      if (key === '__proto__' || key === 'constructor') return undefined;
      return value;
    });
  } catch {
    throw new ApiError(400, 'invalid-option', 'The request body is not valid JSON.');
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new ApiError(400, 'invalid-option', 'The request body must be a JSON object.');
  }

  return Object.assign(Object.create(null), parsed) as Record<string, unknown>;
}
