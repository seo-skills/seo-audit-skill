/**
 * Which destinations an audit run may reach.
 *
 * The policy travels with the run through AsyncLocalStorage rather than
 * through every function signature: a rule ten calls deep makes its request
 * under the policy of the audit that called it, and two runs in one process
 * (`serve`, the desktop app, MCP) never see each other's.
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { isBlockedAddress } from './address.js';

export interface NetPolicy {
  /** Refuse connections to loopback, private, link-local and similar addresses */
  blockPrivate: boolean;
  /** `host:port` pairs reachable even when `blockPrivate` is on */
  allowHosts: ReadonlySet<string>;
  /**
   * Hostnames reachable on private addresses, each only at the addresses it
   * resolved to when the run started. Auto mode pins a local or intranet
   * target this way, so a later DNS answer cannot move it elsewhere.
   */
  pinnedHosts?: ReadonlyMap<string, readonly string[]>;
}

/** A policy that lets every request through */
export const OPEN_POLICY: NetPolicy = { blockPrivate: false, allowHosts: new Set() };

const scope = new AsyncLocalStorage<NetPolicy>();

/** Run `fn`, and every request it makes, under `policy` */
export function runWithNetPolicy<T>(policy: NetPolicy, fn: () => T): T {
  return scope.run(policy, fn);
}

/** The policy of the run this code belongs to; open outside any run */
export function currentNetPolicy(): NetPolicy {
  return scope.getStore() ?? OPEN_POLICY;
}

/** True when every address `hostname` resolves to is public */
export async function resolvesPublic(hostname: string): Promise<boolean> {
  const bare = hostname.replace(/^\[|\]$/g, '');
  if (isIP(bare)) return !isBlockedAddress(bare);
  try {
    const addresses = await lookup(bare, { all: true, verbatim: true });
    return addresses.length > 0 && addresses.every((a) => !isBlockedAddress(a.address));
  } catch {
    // Unresolvable: the audit itself will report that. Nothing private to protect.
    return true;
  }
}

/** A hostname as a pin key: lower case, an IPv6 literal without brackets */
export function pinKey(hostname: string): string {
  return hostname.replace(/^\[|\]$/g, '').toLowerCase();
}

/**
 * The addresses `hostname` resolves to, when every one of them is private.
 *
 * The test that lets a private target through, so it fails closed: a mixed
 * answer (one public address, one private) or a failed lookup is not a
 * private target, and returns null.
 */
export async function privateAddressesOf(hostname: string): Promise<string[] | null> {
  const bare = pinKey(hostname);
  if (isIP(bare)) return isBlockedAddress(bare) ? [bare] : null;
  try {
    const addresses = (await lookup(bare, { all: true, verbatim: true })).map((a) => a.address);
    return addresses.length > 0 && addresses.every((address) => isBlockedAddress(address)) ? addresses : null;
  } catch {
    return null;
  }
}

/**
 * How an audit run treats private destinations.
 *
 * - `auto` (CLI, dashboard, desktop): private destinations are blocked,
 *   so a page cannot point the audit at your router or a cloud metadata
 *   endpoint. The one exception is a target that resolves *only* to private
 *   addresses (a local dev server, an intranet site): that hostname is let
 *   through, pinned to the addresses it resolved to at the start, so a DNS
 *   answer that changes mid-run (rebinding) cannot open the guard. Other
 *   private hosts stay blocked, and a target whose DNS answer mixes public
 *   and private addresses stays blocked.
 * - `strict` (MCP without `--allow-private`): private destinations are
 *   blocked for every request, the target included.
 * - `open`: nothing is blocked.
 */
export type NetMode = 'auto' | 'strict' | 'open';

/** Build the policy for a run against `targetUrl` */
export async function policyForTarget(
  targetUrl: string,
  mode: NetMode,
  allowHosts: Iterable<string> = []
): Promise<NetPolicy> {
  const allow = new Set(allowHosts);
  if (mode === 'open') return { blockPrivate: false, allowHosts: allow };
  if (mode === 'strict') return { blockPrivate: true, allowHosts: allow };
  const hostname = new URL(targetUrl).hostname;
  const pinned = await privateAddressesOf(hostname);
  return { blockPrivate: true, allowHosts: allow, ...(pinned && { pinnedHosts: new Map([[pinKey(hostname), pinned]]) }) };
}
