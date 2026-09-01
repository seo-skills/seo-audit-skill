import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, fail } from '../define-rule.js';

// Reference hints: indexability/canonical-contains-invalid-html-attributes,
// indexability/canonical-contains-superfluous-html-attributes

/**
 * Attributes that change the canonical element's semantics and cause search
 * engines to ignore the annotation entirely.
 */
const INVALID_ATTRIBUTES = ['hreflang', 'lang', 'media', 'type'];

/** A canonical link element may only carry rel and href. */
const ALLOWED_ATTRIBUTES = ['rel', 'href'];

/**
 * Rule: Canonical element attributes
 *
 * A <link rel="canonical"> may only carry rel and href. hreflang, lang,
 * media, or type change the element's semantics and cause search engines to
 * ignore the canonical; any other extra attribute is superfluous and ignored.
 */
export const canonicalAttributesRule = defineRule({
  id: 'core-canonical-attributes',
  name: 'Canonical Attributes',
  description: 'Checks that <link rel="canonical"> elements carry only rel and href attributes',
  category: 'core',
  weight: 7,
  run: async (context: AuditContext) => {
    const { $ } = context;

    const canonicals = $('link[rel="canonical"]');
    if (canonicals.length === 0) {
      return pass(
        'core-canonical-attributes',
        'No canonical element present',
        { found: false }
      );
    }

    const invalid = new Set<string>();
    const superfluous = new Set<string>();

    canonicals.each((_, el) => {
      const attribs = (el as { attribs?: Record<string, string> }).attribs ?? {};
      for (const name of Object.keys(attribs)) {
        const lower = name.toLowerCase();
        if (ALLOWED_ATTRIBUTES.includes(lower)) continue;
        if (INVALID_ATTRIBUTES.includes(lower)) {
          invalid.add(lower);
        } else {
          superfluous.add(lower);
        }
      }
    });

    if (invalid.size > 0) {
      const invalidList = [...invalid].join(', ');
      return fail(
        'core-canonical-attributes',
        `Canonical element carries invalid attribute(s): ${invalidList}`,
        {
          invalidAttributes: [...invalid],
          superfluousAttributes: [...superfluous],
          impact: 'These attributes change the canonical semantics and cause search engines to ignore the annotation',
          recommendation: 'Remove invalid attributes from the canonical element; use alternate annotations (e.g. hreflang links) where appropriate',
        }
      );
    }

    if (superfluous.size > 0) {
      const superfluousList = [...superfluous].join(', ');
      return warn(
        'core-canonical-attributes',
        `Canonical element carries superfluous attribute(s): ${superfluousList}`,
        {
          superfluousAttributes: [...superfluous],
          impact: 'Attributes other than rel and href are ignored on canonical elements',
          recommendation: 'Simplify the canonical element to only rel and href attributes',
        }
      );
    }

    return pass(
      'core-canonical-attributes',
      'Canonical element carries only rel and href attributes',
      { found: true }
    );
  },
});
