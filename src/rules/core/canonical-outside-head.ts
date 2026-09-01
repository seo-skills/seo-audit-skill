import type { AuditContext } from '../../types.js';
import { defineRule, pass, fail } from '../define-rule.js';

// Reference hint: indexability/canonical-outside-of-head

/**
 * Rule: Canonical element outside of <head>
 *
 * A <link rel="canonical"> placed outside the <head> (e.g. in the <body>)
 * is ignored by search engines, so the canonical signal is lost entirely.
 */
export const canonicalOutsideHeadRule = defineRule({
  id: 'core-canonical-outside-head',
  name: 'Canonical Outside Head',
  description: 'Checks that no <link rel="canonical"> element appears outside the <head>',
  category: 'core',
  weight: 8,
  run: async (context: AuditContext) => {
    const { $ } = context;

    const outsideHrefs: string[] = [];
    $('link[rel="canonical"]').each((_, el) => {
      if ($(el).closest('head').length === 0) {
        outsideHrefs.push($(el).attr('href')?.trim() || '(no href)');
      }
    });

    if (outsideHrefs.length === 0) {
      return pass(
        'core-canonical-outside-head',
        'No canonical element outside the <head>',
        { outsideHead: 0 }
      );
    }

    return fail(
      'core-canonical-outside-head',
      `${outsideHrefs.length} canonical element(s) found outside the <head>: ${outsideHrefs.join(', ')}`,
      {
        outsideHead: outsideHrefs.length,
        hrefs: outsideHrefs,
        impact: 'Canonical elements outside the <head> are ignored by search engines',
        recommendation: 'Move the <link rel="canonical"> element into the <head>',
      }
    );
  },
});
