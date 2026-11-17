import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, fail, notMeasured } from '../define-rule.js';
import { fetchPairedPage, samePage } from '../paired-page.js';

const ID = 'technical-amp-pairing';

/**
 * Rule: the AMP version points back
 *
 * A page that declares an AMP version with `<link rel="amphtml">` expects
 * that version to name it as canonical. Otherwise the AMP page is a
 * standalone duplicate, or, when it names neither page, an orphan.
 */
export const ampPairingRule = defineRule({
  id: ID,
  name: 'AMP Pairing',
  description: 'Checks that a declared AMP version loads and names this page as its canonical',
  category: 'technical',
  weight: 5,
  advisory: true,
  run: async (context: AuditContext) => {
    const href = context.$('link[rel~="amphtml" i][href]').first().attr('href');
    if (!href) {
      return notMeasured(ID, 'No AMP version declared', undefined, 'not-applicable');
    }
    let ampUrl: string;
    try {
      ampUrl = new URL(href, context.url).href;
    } catch {
      return fail(ID, `The amphtml URL cannot be resolved: ${href}`);
    }

    const paired = await fetchPairedPage(context, ampUrl);
    if (paired.outcome === 'unverified') {
      return notMeasured(ID, `The AMP page could not be checked: ${paired.why}`, { ampUrl }, paired.reason);
    }
    if (paired.outcome === 'broken') {
      return fail(ID, `The AMP page ${ampUrl} does not load (HTTP ${paired.status})`, { ampUrl, status: paired.status });
    }
    const details = { ampUrl, ampCanonical: paired.canonical ?? null, ampNoindex: paired.noindex };
    if (samePage(paired.canonical, context.url)) {
      return pass(ID, 'The AMP page loads and names this page as its canonical', details);
    }
    // Self-canonical and indexable: a duplicate competing with this page
    if (samePage(paired.canonical, paired.url) && !paired.noindex) {
      return warn(ID, `The AMP page ${ampUrl} is indexable on its own: it names itself as canonical`, {
        ...details,
        recommendation: `Set the AMP page's canonical to ${context.url}.`,
      });
    }
    return fail(ID, `The AMP page ${ampUrl} does not name this page as its canonical`, {
      ...details,
      recommendation: `Add <link rel="canonical" href="${context.url}"> to the AMP page.`,
    });
  },
});
