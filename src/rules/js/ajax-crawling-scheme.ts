import type { AuditContext } from '../../types.js';
import { defineRule, fail, notMeasured } from '../define-rule.js';

const ID = 'js-ajax-crawling-scheme';

/**
 * Rule: no #! URLs for content
 *
 * The AJAX crawling scheme mapped `/#!/page` to `?_escaped_fragment_=/page`
 * so crawlers could fetch a pre-rendered copy. Google stopped doing that in
 * 2018: content reachable only through #! links, or a page that asks for the
 * scheme with `<meta name="fragment" content="!">`, may not be indexed. A
 * bare `href="#!"` placeholder is not a route and does not count.
 */
export const ajaxCrawlingSchemeRule = defineRule({
  id: ID,
  name: 'AJAX Crawling Scheme',
  description: 'Flags #! links and the fragment meta tag of the AJAX crawling scheme, which Google no longer supports',
  category: 'js',
  weight: 5,
  advisory: true,
  run: (context: AuditContext) => {
    const hashBangLinks = [...new Set(context.links.filter((link) => link.isInternal && /#!./.test(link.href)).map((link) => link.href))];
    const fragmentMeta = (context.$('meta[name="fragment" i]').attr('content') ?? '').trim() === '!';
    if (hashBangLinks.length === 0 && !fragmentMeta) {
      return notMeasured(ID, 'The page does not use the AJAX crawling scheme', undefined, 'not-applicable');
    }
    const parts = [
      hashBangLinks.length > 0 ? `${hashBangLinks.length} internal link(s) use #! URLs` : '',
      fragmentMeta ? 'the page declares <meta name="fragment" content="!">' : '',
    ].filter(Boolean);
    return fail(ID, `${parts.join(' and ')}; Google no longer supports the AJAX crawling scheme`, {
      ...(hashBangLinks.length > 0 && { hashBangLinks: hashBangLinks.slice(0, 10), hashBangLinkCount: hashBangLinks.length }),
      fragmentMeta,
      recommendation: 'Give each view a real URL (the History API) and render its content on the server or at load.',
    });
  },
});
