import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn } from '../define-rule.js';
import { headSource, startTags, withoutNoscript } from './head-source.js';

/**
 * Rule: Check for elements in <head> that belong in <body>
 *
 * The <head> element should only contain metadata elements (title, meta, link,
 * script, style, base, noscript). Placing body-level elements in the head
 * causes browsers to break out of head parsing, potentially moving subsequent
 * meta tags into the body where they are ignored.
 */

const INVALID_HEAD_ELEMENTS = new Set([
  'div',
  'span',
  'p',
  'section',
  'article',
  'img',
  'a',
  'table',
  'ul',
  'ol',
  'li',
  'form',
  'button',
  'input',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'main',
  'nav',
  'footer',
  'aside',
  'header',
]);

export const invalidHeadRule = defineRule({
  id: 'htmlval-invalid-head',
  name: 'Valid Head Elements',
  description: 'Checks that <head> contains only valid metadata elements',
  category: 'htmlval',
  weight: 10,
  run: async (context: AuditContext) => {
    // The source, not the parsed tree: the parser moves a <div> written in
    // <head> into <body>, so the tree never shows it. <noscript> content is
    // htmlval-noscript-in-head's to judge.
    const head = headSource(context.html);

    if (head === null) {
      return pass(
        'htmlval-invalid-head',
        'No <head> element found to validate'
      );
    }

    const invalidElements = [
      ...new Set(startTags(withoutNoscript(head)).filter((tag) => INVALID_HEAD_ELEMENTS.has(tag))),
    ];

    if (invalidElements.length > 0) {
      return warn(
        'htmlval-invalid-head',
        `<head> contains elements that belong in <body>: <${invalidElements.join('>, <')}>`,
        { invalidElements, count: invalidElements.length }
      );
    }

    return pass(
      'htmlval-invalid-head',
      '<head> contains only valid metadata elements'
    );
  },
});
