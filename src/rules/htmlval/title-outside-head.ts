import type { AuditContext } from '../../types.js';
import { defineRule, pass, fail } from '../define-rule.js';

/**
 * Rule: Check that every <title> element is inside <head>
 *
 * A <title> placed in the <body> (or anywhere else outside <head>) may be
 * ignored by search engines entirely, so the page can end up without a
 * recognised title for indexing and display in search results.
 */
// Reference hint: on-page/title-tag-outside-of-head
export const titleOutsideHeadRule = defineRule({
  id: 'htmlval-title-outside-head',
  name: 'Title Element Inside Head',
  description: 'Checks that no <title> element appears outside of <head>',
  category: 'htmlval',
  weight: 12,
  run: async (context: AuditContext) => {
    const { $ } = context;

    const outsideTitles: string[] = [];
    $('title').each((_, el) => {
      if ($(el).closest('head').length === 0) {
        outsideTitles.push($(el).text().trim());
      }
    });

    if (outsideTitles.length === 0) {
      return pass(
        'htmlval-title-outside-head',
        $('title').length === 0
          ? 'No <title> element found (checked by core-title-present)'
          : 'All <title> elements are inside <head>',
        { count: $('title').length }
      );
    }

    return fail(
      'htmlval-title-outside-head',
      `Found ${outsideTitles.length} <title> element(s) outside of <head>. Search engines may ignore a title that is not in <head>`,
      { count: outsideTitles.length, titles: outsideTitles }
    );
  },
});
