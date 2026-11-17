/**
 * Broken external links grouped by target, for every report format.
 *
 * A footer link to a dead page shows once, with the pages that carry it,
 * instead of once per page in the rule's findings.
 */
import type { AuditResult } from '../types.js';
import type { ExternalLinksExtras } from '../site/external-links.js';

export interface BrokenExternalSection {
  targets: Array<{ url: string; reason: string; pages: string[]; morePages: number }>;
  /** Broken targets past the ones listed */
  moreTargets: number;
  /** "2 could not be verified · 3 not checked", or empty */
  aside: string;
}

/** The section for a run with broken external links, or null */
export function brokenExternalSection(result: AuditResult, maxTargets = 10, maxPages = 3): BrokenExternalSection | null {
  const ext = result.extras?.externalLinks as ExternalLinksExtras | undefined;
  if (!ext || ext.broken === 0) return null;
  const aside = [
    ext.couldNotVerify > 0 ? `${ext.couldNotVerify} could not be verified` : '',
    ext.notChecked > 0 ? `${ext.notChecked} not checked` : '',
  ]
    .filter(Boolean)
    .join(' · ');
  return {
    targets: ext.brokenTargets.slice(0, maxTargets).map((t) => ({
      url: t.url,
      reason: t.reason,
      pages: t.linkedFrom.slice(0, maxPages),
      morePages: t.linkedFromCount - Math.min(maxPages, t.linkedFrom.length),
    })),
    moreTargets: ext.broken - Math.min(maxTargets, ext.brokenTargets.length),
    aside,
  };
}
