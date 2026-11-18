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
import { isBlockedAddress, isMetadataAddress } from './address.js';
import { rethrowIfAborted, throwIfAborted } from '../errors.js';
import { currentNetPolicy, pinKey, privateAddressesOf, runWithNetPolicy, type NetPolicy } from './policy.js';
import { getUserAgent } from '../crawler/user-agent.js';

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

/**
 * A resolver that refuses private addresses, except the ones a pinned host
 * resolved to. Another name for a pinned machine (the audited host redirecting
 * to its www or full name) connects to the pinned addresses only, so it reaches
 * nothing an IP literal of the target could not.
 */
function guardedLookupFor(pinnedAddresses: ReadonlySet<string>) {
  return (hostname: string, options: object, callback: LookupCallback): void => {
    dnsLookup(hostname, { ...options, all: true, verbatim: true }, (err, addresses) => {
      if (err) return callback(err, []);
      let list = addresses as LookupAddress[];
      const refused = list.find((a) => isBlockedAddress(a.address) && !pinnedAddresses.has(a.address));
      if (refused) {
        const pinned = list.filter((a) => pinnedAddresses.has(a.address));
        if (pinned.length === 0) {
          return callback(new PrivateAddressError(hostname, refused.address) as unknown as NodeJS.ErrnoException, []);
        }
        list = pinned;
      }
      const wantsAll = (options as { all?: boolean }).all === true;
      if (wantsAll) return callback(null, list);
      callback(null, list[0].address, list[0].family);
    });
  };
}

/** A resolver that answers with the addresses a host was pinned to, never DNS */
function pinnedLookup(addresses: readonly string[]) {
  const list: LookupAddress[] = addresses.map((address) => ({ address, family: isIP(address) }));
  return (_hostname: string, options: object, callback: LookupCallback): void => {
    process.nextTick(() => {
      if ((options as { all?: boolean }).all === true) return callback(null, list);
      callback(null, list[0].address, list[0].family);
    });
  };
}

/**
 * Agents kept for reuse, least recently used first. Each pinned local or
 * intranet target has its own, so a long-lived dashboard or desktop process
 * would otherwise keep one per target it ever audited.
 */
const agents = new Map<string, Agent>();
const MAX_AGENTS = 8;

/** How many agents are kept; for tests */
export function cachedAgentCount(): number {
  return agents.size;
}

/** One agent per distinct allow-list and pin set, reused across requests */
function agentFor(policy: NetPolicy): Agent {
  const key = JSON.stringify([[...policy.allowHosts].sort(), [...(policy.pinnedHosts ?? [])].sort()]);
  const existing = agents.get(key);
  if (existing) {
    agents.delete(key);
    agents.set(key, existing);
    return existing;
  }

  const pinnedAddresses = new Set([...(policy.pinnedHosts?.values() ?? [])].flat());
  const base = buildConnector({ lookup: guardedLookupFor(pinnedAddresses) as never });
  const agent = new Agent({
    connect: (options, callback) => {
      const port = options.port || (options.protocol === 'https:' ? '443' : '80');
      if (policy.allowHosts.has(`${options.hostname}:${port}`)) {
        return buildConnector({})(options, callback);
      }
      const bare = pinKey(options.hostname);
      const pinned = policy.pinnedHosts?.get(bare);
      if (pinned) return buildConnector({ lookup: pinnedLookup(pinned) as never })(options, callback);
      if (isIP(bare) && isBlockedAddress(bare) && !pinnedAddresses.has(bare)) {
        callback(new PrivateAddressError(options.hostname, bare), null);
        return;
      }
      return base(options, callback);
    },
  });
  agents.set(key, agent);
  // close() lets requests already on the evicted agent finish; the next
  // request of that run asks agentFor again and gets a fresh one
  for (const [oldKey, oldAgent] of agents) {
    if (agents.size <= MAX_AGENTS) break;
    agents.delete(oldKey);
    oldAgent.close().catch(() => {});
  }
  return agent;
}

/** Most redirects followed from a private entry page when pinning its hops */
const MAX_ENTRY_HOPS = 5;

/**
 * Pin the private hosts a private target's entry page redirects through.
 *
 * Auto mode pins a local or intranet target to the addresses it resolved to.
 * Such a site often answers its start URL with a redirect to another private
 * name: a short name to its full name, a service behind a proxy, a sign-in
 * hop. Each hop that resolves only to private addresses is pinned the same
 * way, so the audit reaches the page it was asked for. Only the entry chain
 * is followed: a private address a page links to later is still refused, and
 * a metadata or link-local hop is never pinned.
 *
 * Each hop waits as long as the run's own page request would (`timeoutMs`),
 * and a cancelled run sends nothing and stops at once.
 */
export async function pinEntryRedirects(
  targetUrl: string,
  policy: NetPolicy,
  options: { timeoutMs?: number; signal?: AbortSignal } = {}
): Promise<NetPolicy> {
  if (!policy.blockPrivate || !policy.pinnedHosts || policy.pinnedHosts.size === 0) return policy;
  const { timeoutMs = 30_000, signal } = options;
  const pins = new Map(policy.pinnedHosts);
  let url = targetUrl;
  for (let hop = 0; hop < MAX_ENTRY_HOPS; hop++) {
    throwIfAborted(signal);
    let location: string | null;
    try {
      const timeout = AbortSignal.timeout(timeoutMs);
      const response = await runWithNetPolicy({ ...policy, pinnedHosts: pins }, () =>
        netFetch(url, {
          redirect: 'manual',
          headers: { 'User-Agent': getUserAgent() },
          signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
        })
      );
      await response.body?.cancel().catch(() => {});
      location = response.status >= 300 && response.status < 400 ? response.headers.get('location') : null;
    } catch (error) {
      rethrowIfAborted(error, signal);
      break; // the audit's own request reports what went wrong
    }
    if (!location) break;
    let next: URL;
    try {
      next = new URL(location, url);
    } catch {
      break;
    }
    if (next.protocol !== 'http:' && next.protocol !== 'https:') break;
    const key = pinKey(next.hostname);
    if (!pins.has(key)) {
      const addresses = await privateAddressesOf(next.hostname);
      // A public hop needs no pin; a metadata or link-local one never gets one
      if (!addresses || addresses.some((address) => isMetadataAddress(address))) break;
      pins.set(key, addresses);
    }
    url = next.href;
  }
  return pins.size === policy.pinnedHosts.size ? policy : { ...policy, pinnedHosts: pins };
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

/** The sitemap protocol's own size limit for one file, uncompressed */
export const MAX_SITEMAP_BYTES = 50 * 1024 * 1024;

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
