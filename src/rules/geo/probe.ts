import { registerResettable } from '../registry.js';
import { getUserAgent } from '../../crawler/user-agent.js';
import { netFetch, readTextPrefix } from '../../net/fetch.js';

export interface ProbeResult {
  status: number;
  contentType: string;
  body: string;
}

const cache = new Map<string, Promise<ProbeResult | null>>();

/** Drop cached probes so the next audit does not reuse the previous origin. */
export function resetGeoProbes(): void {
  cache.clear();
}

registerResettable(resetGeoProbes);

/**
 * Fetch a URL once per audit. Later pages of the same crawl reuse the body.
 *
 * @param url - Absolute URL
 * @param headers - Extra request headers; they are part of the cache key
 * @param signal - Cancellation signal for the audit run
 * @returns The status, content type, and the first 4KB, or null on failure
 */
export function probeOnce(
  url: string,
  headers: Record<string, string> = {},
  signal?: AbortSignal
): Promise<ProbeResult | null> {
  const key = `${url}\n${JSON.stringify(headers)}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const pending = (async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const requestSignal = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal;
    try {
      const response = await netFetch(url, {
        headers: { 'User-Agent': getUserAgent(), ...headers },
        redirect: 'follow',
        signal: requestSignal,
      });
      const body = (await readTextPrefix(response, 16 * 1024)).slice(0, 4000);
      return {
        status: response.status,
        contentType: response.headers.get('content-type') || '',
        body,
      };
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  })();

  cache.set(key, pending);
  return pending;
}

/** True when a 200 body is an HTML document rather than the file we asked for. */
export function looksLikeHtml(result: ProbeResult): boolean {
  return /text\/html/i.test(result.contentType) || /^\s*<!doctype html/i.test(result.body) || /^\s*<html[\s>]/i.test(result.body);
}
