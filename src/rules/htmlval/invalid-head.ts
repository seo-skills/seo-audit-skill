import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn } from '../define-rule.js';

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
    const { $ } = context;
    const head = $('head');

    if (head.length === 0) {
      return pass(
        'htmlval-invalid-head',
        'No <head> element found to validate'
      );
    }

    const invalidElements: string[] = [];

    head.children().each((_, el) => {
      if (el.type === 'tag') {
        const tagName = el.tagName.toLowerCase();
        if (INVALID_HEAD_ELEMENTS.has(tagName)) {
          if (!invalidElements.includes(tagName)) {
            invalidElements.push(tagName);
          }
        }
      }
    });

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
