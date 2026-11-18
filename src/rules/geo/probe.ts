import type { AuditContext } from '../../types.js';
import { urlServiceFor } from '../../net/url-service.js';

export interface ProbeResult {
  status: number;
  contentType: string;
  body: string;
}

/** How much of a probed file the GEO rules read */
const PROBE_BYTES = 16 * 1024;

/**
 * Fetch a URL once per audit. Later pages of the same crawl reuse the answer,
 * through the run's URL service.
 *
 * @param context - The page being audited; its run owns the request
 * @param url - Absolute URL
 * @param headers - Extra request headers; they are part of the memo key
 * @returns The status, content type, and the first 4KB, or null on failure
 */
export async function probeOnce(
  context: Pick<AuditContext, 'url' | 'urls' | 'signal'>,
  url: string,
  headers: Record<string, string> = {}
): Promise<ProbeResult | null> {
  const info = await urlServiceFor(context).get(url, {
    method: 'GET',
    ...(Object.keys(headers).length > 0 && { headers }),
    needBytes: PROBE_BYTES,
  });
  if (info.status === 0) return null;
  return {
    // A server that honours the range answers 206 for a file that exists:
    // the same answer as a 200 to the question these rules ask
    status: info.status === 206 ? 200 : info.status,
    contentType: info.contentType ?? '',
    body: new TextDecoder('utf-8').decode(info.bytes ?? new Uint8Array(0)).slice(0, 4000),
  };
}
/** True when a 200 body is an HTML document rather than the file we asked for. */
export function looksLikeHtml(result: ProbeResult): boolean {
  return /text\/html/i.test(result.contentType) || /^\s*<!doctype html/i.test(result.body) || /^\s*<html[\s>]/i.test(result.body);
}
