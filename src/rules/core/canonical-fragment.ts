import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, notMeasured } from '../define-rule.js';
import { canonicalFromLinkHeader } from '../../indexability.js';

const ID = 'core-canonical-fragment';

/**
 * Rule: a canonical URL with a fragment
 *
 * Google drops everything after `#` in a canonical, so `/page#section` and
 * the hash-bang `/#!/page` both resolve to the bare URL. The canonical then
 * points somewhere the author did not mean, usually the home page for a
 * hash-bang app.
 */
export const canonicalFragmentRule = defineRule({
  id: ID,
  name: 'Canonical Without Fragment',
  description: 'Checks that the canonical URL has no #fragment, which search engines ignore',
  category: 'core',
  weight: 5,
  advisory: true,
  run: (context: AuditContext) => {
    const declared: Array<{ source: 'element' | 'header'; href: string }> = [];
    const element = context.$('link[rel="canonical"]').first().attr('href');
    if (element !== undefined) declared.push({ source: 'element', href: element.trim() });
    const header = canonicalFromLinkHeader(context.headers['link'], context.url);
    if (header !== undefined) declared.push({ source: 'header', href: header });

    if (declared.length === 0) {
      return notMeasured(ID, 'No canonical declared', undefined, 'not-applicable');
    }

    const withFragment = declared.filter((d) => d.href.includes('#'));
    if (withFragment.length === 0) {
      return pass(ID, 'The canonical URL has no fragment', { canonical: declared });
    }

    const first = withFragment[0];
    const bare = first.href.slice(0, first.href.indexOf('#')) || '(the page itself)';
    const hashBang = first.href.includes('#!');
    return warn(
      ID,
      hashBang
        ? `The canonical uses a hash-bang URL (${first.href}); search engines ignore the fragment, so it points at ${bare}`
        : `The canonical has a fragment (${first.href}); search engines ignore it, so it points at ${bare}`,
      {
        canonical: withFragment,
        resolvesTo: bare,
        recommendation: 'Use a canonical URL without #: give each piece of content its own path.',
      }
    );
  },
});
