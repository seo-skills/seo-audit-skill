import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, fail } from '../define-rule.js';
import { findOgTag, nameAttributeMessage } from './open-graph.js';

/**
 * Validates if a string is a valid URL
 */
function isValidUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Rule: Check that an og:url meta tag exists with a valid URL
 */
export const ogUrlRule = defineRule({
  id: 'social-og-url',
  name: 'Open Graph URL',
  description: 'Checks that a <meta property="og:url"> tag exists with a valid URL',
  category: 'social',
  weight: 1,
  run: async (context: AuditContext) => {
    const { $ } = context;
    const tag = findOgTag($, 'og:url');

    if (!tag) {
      return fail(
        'social-og-url',
        'No <meta property="og:url"> tag found in the document',
        { found: false }
      );
    }

    const content = tag.content;

    if (!content) {
      return fail(
        'social-og-url',
        'Open Graph URL tag exists but has no content',
        { found: true, empty: true }
      );
    }

    if (!isValidUrl(content)) {
      return warn(
        'social-og-url',
        `Open Graph URL is not a valid absolute URL: "${content}"`,
        { ogUrl: content, isValidUrl: false }
      );
    }

    if (tag.attribute === 'name') {
      return warn(
        'social-og-url',
        nameAttributeMessage('Open Graph URL', 'og:url'),
        { found: true, ogUrl: content, isValidUrl: true, attribute: 'name' }
      );
    }

    return pass(
      'social-og-url',
      'Open Graph URL tag is present with a valid URL',
      { found: true, ogUrl: content, isValidUrl: true }
    );
  },
});
