import type { AuditContext, SitemapEntry } from '../../types.js';
import { defineRule, pass, warn, notMeasured } from '../define-rule.js';
import { registerResettable } from '../registry.js';

/**
 * Fraction of entries that must share one lastmod before it reads as
 * auto-generated rather than genuine. Some identical dates are normal — a
 * batch publish, a site-wide template change.
 */
const IDENTICAL_RATIO_THRESHOLD = 0.9;

/** Below this, identical dates are unremarkable regardless of ratio. */
const MIN_ENTRIES_TO_JUDGE = 10;

/** Tolerance for clock skew before a date counts as being in the future. */
const FUTURE_TOLERANCE_MS = 24 * 60 * 60 * 1000;

/**
 * Sitemap analysis is site-wide, but rules run per page. Cached so the work
 * happens once per audit instead of once per crawled page.
 */
let cachedResult: { key: string; value: ReturnType<typeof analyse> } | null = null;

export function resetSitemapLastmodCache(): void {
  cachedResult = null;
}

registerResettable(resetSitemapLastmodCache);

interface Analysis {
  total: number;
  withLastmod: number;
  invalid: string[];
  future: string[];
  mostCommonDate?: string;
  mostCommonCount: number;
}

function analyse(entries: SitemapEntry[], now: number): Analysis {
  const counts = new Map<string, number>();
  const invalid: string[] = [];
  const future: string[] = [];
  let withLastmod = 0;

  for (const entry of entries) {
    if (!entry.lastmod) continue;
    withLastmod++;

    const parsed = Date.parse(entry.lastmod);
    if (Number.isNaN(parsed)) {
      if (invalid.length < 5) invalid.push(`${entry.loc} (${entry.lastmod})`);
      continue;
    }
    if (parsed > now + FUTURE_TOLERANCE_MS) {
      if (future.length < 5) future.push(`${entry.loc} (${entry.lastmod})`);
    }

    // Compare by calendar day: same-day timestamps that differ by seconds are
    // still a single bulk regeneration.
    const day = new Date(parsed).toISOString().slice(0, 10);
    counts.set(day, (counts.get(day) ?? 0) + 1);
  }

  let mostCommonDate: string | undefined;
  let mostCommonCount = 0;
  for (const [day, count] of counts) {
    if (count > mostCommonCount) {
      mostCommonDate = day;
      mostCommonCount = count;
    }
  }

  return {
    total: entries.length,
    withLastmod,
    invalid,
    future,
    ...(mostCommonDate !== undefined && { mostCommonDate }),
    mostCommonCount,
  };
}

/**
 * Rule: Sitemap lastmod Quality
 *
 * `<lastmod>` is only useful to a crawler if it is truthful. Google has said
 * it ignores the value on sites where it does not correlate with actual
 * changes, so a sitemap that stamps every URL with today's date at build time
 * is not merely useless — it forfeits the signal entirely.
 *
 * Checks three failure modes: unparseable dates, dates in the future, and a
 * single date shared by effectively every URL.
 */
export const sitemapLastmodRule = defineRule({
  id: 'crawl-sitemap-lastmod',
  name: 'Sitemap lastmod Quality',
  description:
    'Checks sitemap <lastmod> values for invalid dates, future dates, and bulk-identical timestamps',
  category: 'crawl',
  weight: 5,
  run: (context: AuditContext) => {
    const entries = context.sitemapEntries;

    if (entries === undefined) {
      return notMeasured(
        'crawl-sitemap-lastmod',
        'Sitemap not available, so lastmod values could not be checked'
      );
    }

    if (entries.length === 0) {
      return pass('crawl-sitemap-lastmod', 'No sitemap entries to check', { entryCount: 0 });
    }

    const key = `${entries.length}:${entries[0]?.loc ?? ''}`;
    if (!cachedResult || cachedResult.key !== key) {
      cachedResult = { key, value: analyse(entries, Date.now()) };
    }
    const analysis = cachedResult.value as Analysis;

    const details = {
      entryCount: analysis.total,
      withLastmod: analysis.withLastmod,
      invalidDates: analysis.invalid,
      futureDates: analysis.future,
      mostCommonDate: analysis.mostCommonDate,
      mostCommonDateCount: analysis.mostCommonCount,
    };

    if (analysis.withLastmod === 0) {
      return warn(
        'crawl-sitemap-lastmod',
        `No sitemap entries declare <lastmod> (${analysis.total} URLs)`,
        {
          ...details,
          recommendation:
            'Add <lastmod> reflecting genuine content changes so crawlers can prioritise what actually changed.',
        }
      );
    }

    if (analysis.invalid.length > 0) {
      return warn(
        'crawl-sitemap-lastmod',
        `${analysis.invalid.length} sitemap entr(ies) have an unparseable <lastmod>: ${analysis.invalid[0]}`,
        {
          ...details,
          recommendation: 'lastmod must be a W3C Datetime, e.g. 2026-08-31 or 2026-08-31T12:00:00+00:00.',
        }
      );
    }

    if (analysis.future.length > 0) {
      return warn(
        'crawl-sitemap-lastmod',
        `${analysis.future.length} sitemap entr(ies) declare a <lastmod> in the future: ${analysis.future[0]}`,
        details
      );
    }

    const ratio = analysis.withLastmod > 0 ? analysis.mostCommonCount / analysis.withLastmod : 0;
    if (analysis.withLastmod >= MIN_ENTRIES_TO_JUDGE && ratio >= IDENTICAL_RATIO_THRESHOLD) {
      return warn(
        'crawl-sitemap-lastmod',
        `${analysis.mostCommonCount} of ${analysis.withLastmod} URLs share the same <lastmod> (${analysis.mostCommonDate}), which looks generated rather than genuine`,
        {
          ...details,
          impact:
            'Google discounts lastmod on sites where it does not track real changes, so an inaccurate value forfeits the signal for every URL.',
        }
      );
    }

    return pass(
      'crawl-sitemap-lastmod',
      `Sitemap <lastmod> values look genuine (${analysis.withLastmod}/${analysis.total} URLs dated)`,
      details
    );
  },
});
