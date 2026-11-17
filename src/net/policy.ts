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

/**
 * How an audit run treats private destinations.
 *
 * - `auto` (CLI, dashboard, desktop): a public target blocks private
 *   destinations taken from its pages, so a page cannot point the audit at
 *   your router or a cloud metadata endpoint. A private target (a local dev
 *   server, an intranet site) is audited as before.
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
  return { blockPrivate: await resolvesPublic(hostname), allowHosts: allow };
}
