import type { AuditContext } from '../../types.js';
import { defineRule, notMeasured, pass, warn } from '../define-rule.js';
import { countWords, extractMainContent } from './utils/text-extractor.js';
import { pageKindFrom, type PageKind } from './page-kind.js';

/** Below this many siblings of the same kind, a median is noise. */
const MIN_SAMPLE = 4;

/** A page this far under its kind's median is the outlier. */
const OUTLIER_RATIO = 0.5;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/**
 * Rule: Thin against the site's own pages of the same kind
 *
 * A 200-word product page is normal when the other product pages are that
 * length. The same count on an article site whose articles run to 1,200
 * words is the outlier. The absolute word-count rule still applies on its own.
 */
export const thinVsSiteRule = defineRule({
  id: 'content-thin-vs-site',
  name: 'Thin Versus Site Norm',
  description: 'Checks that a page is not far shorter than the median page of the same kind',
  category: 'content',
  weight: 4,
  run: (context: AuditContext) => {
    const pages = context.site?.pages;
    if (!pages || (context.site?.pageCount ?? 0) < MIN_SAMPLE) {
      return notMeasured(
        'content-thin-vs-site',
        'Comparing length with the rest of the site needs a crawl of at least four pages', undefined, 'needs-crawl'
      );
    }

    const key = context.site!.normalize(context.url);
    const own = pages.get(key);
    const kind: PageKind = own?.pageKind ?? pageKindFrom([], context.url);
    const words = own?.wordCount ?? countWords(extractMainContent(context.$));

    const sample: number[] = [];
    for (const info of pages.values()) {
      if ((info.pageKind ?? 'other') !== kind) continue;
      if (typeof info.wordCount === 'number') sample.push(info.wordCount);
    }

    if (sample.length < MIN_SAMPLE) {
      return pass('content-thin-vs-site', `Fewer than ${MIN_SAMPLE} ${kind} pages to compare`, {
        kind,
        words,
        sample: sample.length,
      });
    }

    const typical = median(sample);
    if (words >= typical * OUTLIER_RATIO) {
      return pass('content-thin-vs-site', `${words} words is within the ${kind} median of ${Math.round(typical)}`, {
        kind,
        words,
        median: typical,
      });
    }

    return warn(
      'content-thin-vs-site',
      `${words} words is under half the ${kind} median of ${Math.round(typical)}`,
      {
        kind,
        words,
        median: typical,
        recommendation: `Bring this ${kind} page toward the length of the other ${kind} pages, about ${Math.round(typical)} words.`,
      }
    );
  },
});
