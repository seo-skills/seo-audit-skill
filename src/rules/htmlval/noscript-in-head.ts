import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn } from '../define-rule.js';
import { headSource, noscriptBodies, startTags } from './head-source.js';

/**
 * Rule: Check for invalid content inside <noscript> in <head>
 *
 * Per the HTML5 specification, a <noscript> element inside <head> may only
 * contain <link>, <style>, and <meta> elements. Any other content is invalid
 * and may cause parsing issues.
 */

const PERMITTED_NOSCRIPT_HEAD_ELEMENTS = new Set([
  'link',
  'style',
  'meta',
]);

export const noscriptInHeadRule = defineRule({
  id: 'htmlval-noscript-in-head',
  name: 'Noscript in Head',
  description: 'Checks that <noscript> inside <head> contains only permitted elements (link, style, meta)',
  category: 'htmlval',
  weight: 5,
  run: async (context: AuditContext) => {
    // The source, not the parsed tree: parse5 keeps <noscript> content as
    // text, so its children were always empty.
    const headNoscripts = noscriptBodies(headSource(context.html) ?? '');

    if (headNoscripts.length === 0) {
      return pass(
        'htmlval-noscript-in-head',
        'No <noscript> elements found in <head>'
      );
    }

    const invalidElements = [
      ...new Set(
        headNoscripts.flatMap(startTags).filter((tag) => !PERMITTED_NOSCRIPT_HEAD_ELEMENTS.has(tag))
      ),
    ];

    if (invalidElements.length > 0) {
      return warn(
        'htmlval-noscript-in-head',
        `<noscript> in <head> contains non-permitted elements: <${invalidElements.join('>, <')}>. Only <link>, <style>, and <meta> are allowed`,
        { invalidElements, count: invalidElements.length }
      );
    }

    return pass(
      'htmlval-noscript-in-head',
      '<noscript> in <head> contains only permitted elements'
    );
  },
});
