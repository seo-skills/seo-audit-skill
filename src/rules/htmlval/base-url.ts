import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, fail } from '../define-rule.js';

/**
 * Rule: Validate the <base> element
 *
 * The <base> element sets the base URL for every relative link on the page.
 * An empty or malformed base href breaks relative-link resolution for
 * crawlers, and a document may contain at most one <base> element — extra
 * ones are invalid, and conflicting ones leave the effective base
 * ambiguous.
 */
// Reference hints: indexability/base-url-malformed-or-empty,
// indexability/multiple-base-urls, indexability/multiple-mismatched-base-urls

const ABSOLUTE_SCHEME_PATTERN = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;

interface BaseUrlProblem {
  href: string;
  reason: 'empty' | 'malformed' | 'invalid-protocol';
}

/**
 * Classifies a single base href. Returns null when the href is usable.
 * Relative hrefs are valid per the HTML spec and resolve against the page URL.
 */
function classifyBaseHref(rawHref: string | undefined, pageUrl: string): BaseUrlProblem | null {
  const href = (rawHref ?? '').trim();

  if (href.length === 0) {
    return { href: rawHref ?? '', reason: 'empty' };
  }

  if (/\s/.test(href)) {
    return { href, reason: 'malformed' };
  }

  if (ABSOLUTE_SCHEME_PATTERN.test(href) && !/^https?:\/\//i.test(href)) {
    return { href, reason: 'invalid-protocol' };
  }

  try {
    new URL(href, pageUrl);
  } catch {
    return { href, reason: 'malformed' };
  }

  return null;
}

export const baseUrlRule = defineRule({
  id: 'htmlval-base-url',
  name: 'Valid Base URL',
  description: 'Checks that the document has at most one <base> element with a valid href',
  category: 'htmlval',
  weight: 6,
  run: async (context: AuditContext) => {
    const { $ } = context;
    const baseElements = $('base');

    if (baseElements.length === 0) {
      return pass('htmlval-base-url', 'No <base> element found', { count: 0 });
    }

    const hrefs: string[] = [];
    const problems: BaseUrlProblem[] = [];

    baseElements.each((_, el) => {
      const rawHref = $(el).attr('href');
      hrefs.push(rawHref ?? '');
      const problem = classifyBaseHref(rawHref, context.url);
      if (problem) {
        problems.push(problem);
      }
    });

    if (problems.length > 0) {
      const descriptions = problems.map((p) =>
        p.reason === 'empty' ? 'empty href' : `"${p.href}" (${p.reason})`
      );
      return fail(
        'htmlval-base-url',
        `<base> href is empty or malformed: ${descriptions.join(', ')}. Relative links on the page may not resolve correctly for crawlers`,
        { count: baseElements.length, hrefs, problems }
      );
    }

    if (baseElements.length > 1) {
      const distinctHrefs = [...new Set(hrefs.map((h) => h.trim()))];

      if (distinctHrefs.length > 1) {
        return fail(
          'htmlval-base-url',
          `Document has ${baseElements.length} <base> elements with different hrefs (${distinctHrefs.join(', ')}). Only one <base> element is allowed per document`,
          { count: baseElements.length, hrefs }
        );
      }

      return warn(
        'htmlval-base-url',
        `Document has ${baseElements.length} <base> elements. Only one <base> element is allowed per document`,
        { count: baseElements.length, hrefs }
      );
    }

    return pass(
      'htmlval-base-url',
      `Document has a single valid <base> element (${hrefs[0]})`,
      { count: 1, hrefs }
    );
  },
});
