import type { AuditResult } from '../types.js';

/**
 * "Measured 4 of 5 pages · 1 rate-limited", or null when a crawl measured
 * every page it tried. One wording for every report, so the console, the
 * markdown and the agent report never disagree about coverage.
 */
export function coverageLine(result: AuditResult): string | null {
  const coverage = result.coverage;
  if (!coverage?.attempted || coverage.measured === undefined) return null;
  if (coverage.measured >= coverage.attempted) return null;
  const parts = [`Measured ${coverage.measured} of ${coverage.attempted} pages`];
  if (coverage.rateLimited) parts.push(`${coverage.rateLimited} rate-limited`);
  if (coverage.failed) parts.push(`${coverage.failed} failed to load`);
  if (coverage.notFetched) parts.push(`${coverage.notFetched} not fetched`);
  return parts.join(' · ');
}
