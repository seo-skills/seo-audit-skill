/**
 * Which IP addresses an audit must not reach on someone else's behalf.
 *
 * Loopback, private, link-local (cloud metadata lives at 169.254.169.254),
 * shared address space, unique-local and the unspecified address, in every
 * spelling an attacker might use: IPv4-mapped and NAT64-embedded IPv6 forms
 * are unwrapped and checked as the IPv4 address they carry.
 */

import { isIP } from 'node:net';

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const n = Number(part);
    if (n > 255) return null;
    value = value * 256 + n;
  }
  return value;
}

/** [network, prefix length] pairs, as integers */
const BLOCKED_V4: Array<[string, number]> = [
  ['0.0.0.0', 8], // "this network", including 0.0.0.0
  ['10.0.0.0', 8],
  ['100.64.0.0', 10], // shared address space (carrier NAT)
  ['127.0.0.0', 8],
  ['169.254.0.0', 16], // link-local, cloud metadata
  ['172.16.0.0', 12],
  ['192.0.0.0', 24], // IETF protocol assignments
  ['192.168.0.0', 16],
  ['198.18.0.0', 15], // benchmarking
  ['224.0.0.0', 4], // multicast
  ['240.0.0.0', 4], // reserved, and the broadcast address
];

function inV4Range(value: number, network: string, prefix: number): boolean {
  const base = ipv4ToInt(network)!;
  const size = 2 ** (32 - prefix);
  return value >= base && value < base + size;
}

function isBlockedV4(ip: string): boolean {
  const value = ipv4ToInt(ip);
  if (value === null) return true; // unparseable: refuse rather than guess
  return BLOCKED_V4.some(([network, prefix]) => inV4Range(value, network, prefix));
}

/** Expand an IPv6 address to its eight 16-bit groups */
function ipv6Groups(ip: string): number[] | null {
  let address = ip.toLowerCase();
  const zone = address.indexOf('%');
  if (zone !== -1) address = address.slice(0, zone);

  // A trailing dotted IPv4 (::ffff:1.2.3.4) becomes two groups
  const dotted = address.match(/^(.*:)(\d+\.\d+\.\d+\.\d+)$/);
  if (dotted) {
    const v4 = ipv4ToInt(dotted[2]);
    if (v4 === null) return null;
    address = `${dotted[1]}${(v4 >>> 16).toString(16)}:${(v4 & 0xffff).toString(16)}`;
  }

  const halves = address.split('::');
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(':') : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  const missing = 8 - head.length - tail.length;
  if (halves.length === 1 && missing !== 0) return null;
  if (missing < 0) return null;

  const groups = [...head, ...Array(halves.length === 2 ? missing : 0).fill('0'), ...tail];
  const values = groups.map((g) => (/^[0-9a-f]{1,4}$/.test(g) ? parseInt(g, 16) : NaN));
  return values.some(Number.isNaN) ? null : values;
}

function embeddedV4(groups: number[]): string {
  const hi = groups[6];
  const lo = groups[7];
  return `${hi >> 8}.${hi & 0xff}.${lo >> 8}.${lo & 0xff}`;
}

/**
 * The IPv4 address an IPv6 address carries, in every form that embeds one:
 * IPv4-mapped, the deprecated compatible form, NAT64 well-known, translated
 * and 6to4. Null for an address that embeds none (and for :: and ::1, which
 * the compatible form would otherwise read as 0.0.0.0 and 0.0.0.1).
 */
function embeddedV4Of(g: number[]): string | null {
  const allZero = (from: number, to: number) => g.slice(from, to).every((v) => v === 0);
  if (allZero(0, 7) && (g[7] === 0 || g[7] === 1)) return null; // :: and ::1
  if (allZero(0, 5) && g[5] === 0xffff) return embeddedV4(g); // ::ffff:a.b.c.d
  if (allZero(0, 6)) return embeddedV4(g); // ::a.b.c.d (deprecated compatible form)
  if (g[0] === 0x64 && g[1] === 0xff9b && allZero(2, 6)) return embeddedV4(g); // NAT64 well-known
  if (allZero(0, 4) && g[4] === 0xffff && g[5] === 0) return embeddedV4(g); // ::ffff:0:a.b.c.d translated
  if (g[0] === 0x2002) return `${g[1] >> 8}.${g[1] & 0xff}.${g[2] >> 8}.${g[2] & 0xff}`; // 6to4
  return null;
}

function isBlockedV6(ip: string): boolean {
  const g = ipv6Groups(ip);
  if (!g) return true;

  const allZero = (from: number, to: number) => g.slice(from, to).every((v) => v === 0);

  if (allZero(0, 8)) return true; // ::
  if (allZero(0, 7) && g[7] === 1) return true; // ::1
  const v4 = embeddedV4Of(g);
  if (v4 !== null) return isBlockedV4(v4);
  if (g[0] === 0x64 && g[1] === 0xff9b && g[2] === 0x0001) return true; // 64:ff9b:1::/48 local-use NAT64
  if ((g[0] & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
  if ((g[0] & 0xffc0) === 0xfe80) return true; // fe80::/10 link local
  if ((g[0] & 0xff00) === 0xff00) return true; // ff00::/8 multicast
  return false;
}

/** Cloud metadata endpoints outside the link-local ranges */
const METADATA_V4 = [
  '100.100.100.200', // Alibaba Cloud
  '192.0.0.192', // Oracle Cloud (legacy)
];
const METADATA_V6 = ['fd00:ec2::254']; // AWS instance metadata over IPv6

/**
 * True for an address a redirect must never be pinned to: link-local
 * (169.254.0.0/16, where cloud metadata lives, and fe80::/10) or a known
 * metadata endpoint, in every spelling that embeds an IPv4 address.
 */
export function isMetadataAddress(ip: string): boolean {
  const bare = ip.replace(/^\[|\]$/g, '');
  const family = isIP(bare);
  if (family === 4) {
    const value = ipv4ToInt(bare);
    if (value === null) return false;
    return inV4Range(value, '169.254.0.0', 16) || METADATA_V4.some((endpoint) => ipv4ToInt(endpoint) === value);
  }
  if (family !== 6) return false;
  const g = ipv6Groups(bare);
  if (!g) return false;
  if ((g[0] & 0xffc0) === 0xfe80) return true;
  // Local-use NAT64 (64:ff9b:1::/48) can place an IPv4 address anywhere in the
  // suffix, so no embedded address can be read out of it: never pin one
  if (g[0] === 0x64 && g[1] === 0xff9b && g[2] === 0x0001) return true;
  if (METADATA_V6.some((endpoint) => ipv6Groups(endpoint)!.every((value, index) => value === g[index]))) return true;
  const v4 = embeddedV4Of(g);
  return v4 !== null && isMetadataAddress(v4);
}

/**
 * True when an audit must not connect to this address.
 *
 * Anything that is not a parseable IP is refused too: this runs on resolver
 * output, where an unparseable answer is a reason to stop, not to guess.
 */
export function isBlockedAddress(ip: string): boolean {
  const family = isIP(ip.replace(/^\[|\]$/g, ''));
  const bare = ip.replace(/^\[|\]$/g, '');
  if (family === 4) return isBlockedV4(bare);
  if (family === 6) return isBlockedV6(bare);
  return true;
}
