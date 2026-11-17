import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, fail, notMeasured } from '../define-rule.js';
import { fetchPairedPage, samePage } from '../paired-page.js';

const ID = 'mobile-separate-urls';

/** A media query that targets phones: any max-width of 640px or less */
function targetsMobile(media: string): boolean {
  return [...media.matchAll(/max-width\s*:\s*(\d+(?:\.\d+)?)px/gi)].some((m) => Number(m[1]) <= 640);
}

/**
 * Rule: a separate mobile URL points back
 *
 * A site with separate mobile URLs (m.example.com) declares the mobile page
 * with `<link rel="alternate" media="...max-width: 640px...">`, and the mobile
 * page declares the desktop one as canonical. Without the canonical back,
 * the two compete as duplicates.
 */
export const separateUrlsRule = defineRule({
  id: ID,
  name: 'Separate Mobile URL',
  description: 'Checks that a declared mobile alternate URL loads and names this page as its canonical',
  category: 'mobile',
  weight: 5,
  advisory: true,
  run: async (context: AuditContext) => {
    const { $ } = context;
    const link = $('link[rel~="alternate" i][media][href]')
      .toArray()
      .find((el) => targetsMobile($(el).attr('media') ?? ''));
    if (!link) {
      return notMeasured(ID, 'No separate mobile URL declared', undefined, 'not-applicable');
    }
    let mobileUrl: string;
    try {
      mobileUrl = new URL($(link).attr('href')!, context.url).href;
    } catch {
      return fail(ID, `The mobile alternate URL cannot be resolved: ${$(link).attr('href')}`);
    }

    const paired = await fetchPairedPage(context, mobileUrl);
    if (paired.outcome === 'unverified') {
      return notMeasured(ID, `The mobile page could not be checked: ${paired.why}`, { mobileUrl }, paired.reason);
    }
    if (paired.outcome === 'broken') {
      return fail(ID, `The mobile page ${mobileUrl} does not load (HTTP ${paired.status})`, { mobileUrl, status: paired.status });
    }
    if (!samePage(paired.canonical, context.url)) {
      return warn(ID, `The mobile page ${mobileUrl} does not name this page as its canonical`, {
        mobileUrl,
        mobileCanonical: paired.canonical ?? null,
        recommendation: `Add <link rel="canonical" href="${context.url}"> to the mobile page.`,
      });
    }
    return pass(ID, 'The mobile page loads and names this page as its canonical', { mobileUrl });
  },
});
