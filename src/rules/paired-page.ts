/**
 * A page paired with the audited one (its mobile version, its AMP version),
 * fetched once per run and read for the canonical and robots directives that
 * tie the pair together.
 */
import * as cheerio from 'cheerio';
import type { AuditContext } from '../types.js';
import { urlServiceFor } from '../net/url-service.js';
import { isNoindex, readCanonical } from '../indexability.js';

export type PairedPage =
  | { outcome: 'unverified'; reason: 'disabled' | 'could-not-verify'; why: string }
  | { outcome: 'broken'; status: number }
  | { outcome: 'ok'; url: string; canonical: string | null | undefined; noindex: boolean };

export async function fetchPairedPage(context: AuditContext, url: string): Promise<PairedPage> {
  const sameOrigin = new URL(url).origin === new URL(context.url).origin;
  if (!sameOrigin && context.externalLinks?.enabled === false) {
    return { outcome: 'unverified', reason: 'disabled', why: 'external requests are off ([external_links] enabled = false)' };
  }
  const info = await urlServiceFor(context).get(url, { method: 'GET', needBytes: 'all' });
  if (info.status === 0 || info.rateLimited) {
    return { outcome: 'unverified', reason: 'could-not-verify', why: info.rateLimited ? `rate-limited (HTTP ${info.status})` : (info.failure ?? 'no response') };
  }
  if (sameOrigin ? info.status !== 200 : info.verdict === 'broken') return { outcome: 'broken', status: info.status };
  if (info.verdict !== 'ok') return { outcome: 'unverified', reason: 'could-not-verify', why: `refused (HTTP ${info.status})` };

  const $ = cheerio.load(new TextDecoder('utf-8').decode(info.bytes ?? new Uint8Array(0)));
  const finalUrl = info.finalUrl || url;
  return {
    outcome: 'ok',
    url: finalUrl,
    canonical: readCanonical({ $, headers: info.headers, url: finalUrl }),
    noindex: isNoindex({ $, headers: info.headers }),
  };
}

/** Two URLs for the same page: host case, fragment and a trailing slash aside */
export function samePage(a: string | null | undefined, b: string): boolean {
  if (!a) return false;
  const key = (raw: string) => {
    const url = new URL(raw);
    url.hash = '';
    const path = url.pathname.length > 1 ? url.pathname.replace(/\/+$/, '') : url.pathname;
    return `${url.protocol}//${url.host.toLowerCase()}${path}${url.search}`;
  };
  try {
    return key(a) === key(b);
  } catch {
    return false;
  }
}
