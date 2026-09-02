import type { AssetInfo } from '../../types.js';

/**
 * Reading an asset's encoded size, and telling "small" apart from "unknown".
 *
 * Asset bodies are never captured, so every size-based perf rule reads the
 * `content-length` response header. That header is optional: a response sent
 * with `Transfer-Encoding: chunked` carries none, and HTTP/2 and HTTP/3 frame
 * the body themselves so origins frequently omit it. It is a majority case on
 * real sites, not an edge case — 29 of 30 stylesheets and scripts on
 * seomator.com and 89 of 92 on vercel.com arrive without one.
 *
 * When each rule folded the size test into a single `filter()`, an asset with
 * no `content-length` fell out of the offender list exactly like an asset that
 * was comfortably under the threshold, and the rule then reported a pass. That
 * pass is a positive claim — "all sizable text assets are compressed" — about
 * files the audit never sized.
 *
 * These helpers keep the two apart so a rule can say "measured, and fine" and
 * "could not measure" as different answers, per the `notMeasured()` contract in
 * `define-rule.ts`: you cannot score what you did not measure.
 */

/**
 * The asset's encoded size from `content-length`.
 *
 * @param asset - The asset to size
 * @returns The size in bytes, or null when the header is absent or unparseable
 */
export function assetContentLength(asset: AssetInfo): number | null {
  const raw = asset.headers['content-length'];
  if (!raw) return null;
  const parsed = parseInt(raw, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * Split candidate assets by whether their size could be read at all.
 *
 * Callers filter down to the assets a rule cares about first (text assets, say,
 * or stylesheets without a `.min.` marker), then partition. `sized` is safe to
 * compare against a byte threshold; `unsized` is the evidence gap the rule has
 * to disclose rather than quietly treat as "under the threshold".
 *
 * @param candidates - Assets the rule would flag if they were large enough
 * @returns The candidates split into those carrying a size and those not
 */
export function partitionBySizeKnown<T extends AssetInfo>(
  candidates: T[]
): { sized: T[]; unsized: T[] } {
  const sized: T[] = [];
  const unsized: T[] = [];
  for (const asset of candidates) {
    if (assetContentLength(asset) === null) {
      unsized.push(asset);
    } else {
      sized.push(asset);
    }
  }
  return { sized, unsized };
}

/**
 * The stock explanation for assets whose size could not be read.
 *
 * @param count - How many candidate assets carried no `content-length`
 * @param noun - What the assets are, e.g. 'stylesheet' or 'text asset'
 * @returns A sentence naming the gap and why it exists
 */
export function unsizedReason(count: number, noun: string): string {
  return (
    `${count} ${noun}(s) were served without a content-length header ` +
    `(chunked or HTTP/2 framing), so their size could not be read`
  );
}
