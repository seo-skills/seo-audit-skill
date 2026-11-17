/**
 * The one way the engine makes an HTTP request.
 *
 * Every request goes through `netFetch`, so the run's network policy applies
 * to all of them: page fetches, robots.txt, sitemaps, redirect probes and
 * rule checks alike. A test fails on any bare `fetch(` elsewhere in `src/`.
 *
 * Under a blocking policy the request goes through an undici agent whose
 * connector checks every connection it opens:
 * - a hostname is resolved once, checked, and the socket is opened to that
 *   same address, so a DNS answer that changes between check and connect
 *   (DNS rebinding) cannot slip through;
 * - an IP literal, which skips the resolver entirely, is checked directly;
 * - redirects open new connections through the same connector, so a public
 *   page that redirects to 127.0.0.1 is refused at the hop.
 */

import { lookup as dnsLookup, type LookupAddress } from 'node:dns';
import { isIP } from 'node:net';
import { Agent, buildConnector } from 'undici';
import { isBlockedAddress } from './address.js';
import { currentNetPolicy, type NetPolicy } from './policy.js';

/** A request refused because its destination resolves to a private address */
export class PrivateAddressError extends Error {
  readonly code = 'private-address';
  constructor(
    readonly host: string,
    readonly address: string
  ) {
    super(`Refused to connect to ${host} (${address}): it resolves to a private, loopback or link-local address`);
    this.name = 'PrivateAddressError';
  }
}

/** True when `error`, or its cause chain, is a refusal by the network policy */
export function isPrivateAddressError(error: unknown): error is PrivateAddressError {
  let current: unknown = error;
  for (let depth = 0; current && depth < 5; depth++) {
    if (current instanceof PrivateAddressError) return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

/** Find the refusal in an error's cause chain, for messages */
export function findPrivateAddressError(error: unknown): PrivateAddressError | undefined {
  let current: unknown = error;
  for (let depth = 0; current && depth < 5; depth++) {
    if (current instanceof PrivateAddressError) return current;
    current = (current as { cause?: unknown }).cause;
  }
  return undefined;
}

type LookupCallback = (err: NodeJS.ErrnoException | null, address: string | LookupAddress[], family?: number) => void;

function guardedLookup(hostname: string, options: object, callback: LookupCallback): void {
  dnsLookup(hostname, { ...options, all: true, verbatim: true }, (err, addresses) => {
    if (err) return callback(err, []);
    const list = addresses as LookupAddress[];
    const refused = list.find((a) => isBlockedAddress(a.address));
    if (refused) return callback(new PrivateAddressError(hostname, refused.address) as unknown as NodeJS.ErrnoException, []);
    const wantsAll = (options as { all?: boolean }).all === true;
    if (wantsAll) return callback(null, list);
    callback(null, list[0].address, list[0].family);
  });
}

const agents = new Map<string, Agent>();

/** One agent per distinct allow-list, reused across requests */
function agentFor(policy: NetPolicy): Agent {
  const key = [...policy.allowHosts].sort().join(',');
  const existing = agents.get(key);
  if (existing) return existing;

  const base = buildConnector({ lookup: guardedLookup as never });
  const agent = new Agent({
    connect: (options, callback) => {
      const port = options.port || (options.protocol === 'https:' ? '443' : '80');
      if (policy.allowHosts.has(`${options.hostname}:${port}`)) {
        return buildConnector({})(options, callback);
      }
      const bare = options.hostname.replace(/^\[|\]$/g, '');
      if (isIP(bare) && isBlockedAddress(bare)) {
        callback(new PrivateAddressError(options.hostname, bare), null);
        return;
      }
      return base(options, callback);
    },
  });
  agents.set(key, agent);
  return agent;
}

/**
 * `fetch`, under the current run's network policy.
 *
 * With no blocking policy this is the platform `fetch`, unchanged. Under one,
 * a refused destination rejects like a network error, with a
 * {@link PrivateAddressError} as its cause.
 */
export async function netFetch(input: string | URL, init?: RequestInit): Promise<Response> {
  const policy = currentNetPolicy();
  if (!policy.blockPrivate) return globalThis.fetch(input, init);

  // The platform fetch with a guarded dispatcher, rather than undici's own
  // fetch: one fetch implementation for every request, policy or not.
  return globalThis.fetch(input, { ...init, dispatcher: agentFor(policy) } as RequestInit);
}

/** A body larger than its cap; the request is abandoned at the cap */
export class BodyTooLargeError extends Error {
  readonly code = 'body-too-large';
  constructor(readonly limit: number) {
    super(`Response body exceeds ${Math.round(limit / 1024 / 1024)} MB`);
    this.name = 'BodyTooLargeError';
  }
}

/** The most a page body may be: larger answers are not HTML anyone ranks */
export const MAX_PAGE_BYTES = 10 * 1024 * 1024;

/**
 * Read a response body as bytes, stopping at `maxBytes`.
 *
 * Reading `response.text()` buffers whatever the server sends, so one huge
 * or endless response could exhaust memory before any timeout fired.
 */
export async function readBodyCapped(response: Response, maxBytes: number): Promise<Uint8Array> {
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) {
    await response.body?.cancel().catch(() => {});
    throw new BodyTooLargeError(maxBytes);
  }
  if (!response.body) return new Uint8Array(0);

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      throw new BodyTooLargeError(maxBytes);
    }
    chunks.push(value);
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

/**
 * Read a response body as text, stopping at `maxBytes`.
 *
 * Decodes as UTF-8, exactly as `response.text()` does, so callers that
 * switch to it see the same text.
 */
export async function readTextCapped(response: Response, maxBytes: number): Promise<string> {
  return new TextDecoder('utf-8').decode(await readBodyCapped(response, maxBytes));
}

/**
 * The first `maxBytes` of a body as text; the rest is never downloaded.
 *
 * For callers that only look at the start of a response, where a long body
 * is not an error, just more than they need.
 */
export async function readTextPrefix(response: Response, maxBytes: number): Promise<string> {
  return new TextDecoder('utf-8').decode(await readBytesPrefix(response, maxBytes));
}

/** The first `maxBytes` of a body; the rest is never downloaded. */
export async function readBytesPrefix(response: Response, maxBytes: number): Promise<Uint8Array> {
  if (!response.body) return new Uint8Array(0);
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (total < maxBytes) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.byteLength;
  }
  await reader.cancel().catch(() => {});
  const body = new Uint8Array(Math.min(total, maxBytes));
  let offset = 0;
  for (const chunk of chunks) {
    const room = body.length - offset;
    if (room <= 0) break;
    body.set(chunk.subarray(0, room), offset);
    offset += Math.min(chunk.byteLength, room);
  }
  return body;
}
