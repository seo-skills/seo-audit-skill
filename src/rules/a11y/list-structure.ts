import type { AuditContext } from '../../types.js';
import { defineRule, pass, fail } from '../define-rule.js';

/** Elements a list may legitimately contain besides <li> */
const ALLOWED_IN_LIST = new Set(['li', 'script', 'template']);

/**
 * Rule: Check list markup structure
 *
 * Screen readers announce lists as "list, N items". Stray children throw that
 * count off, and an <li> outside a list parent is not announced as a list item
 * at all.
 */
export const listStructureRule = defineRule({
  id: 'a11y-list-structure',
  name: 'List Structure',
  description: 'Checks that lists contain only list items and that items sit inside a list',
  category: 'a11y',
  weight: 4,
  run: (context: AuditContext) => {
    const { $, url } = context;

    const issues: { problem: string; detail: string }[] = [];

    $('ul, ol').each((_, el) => {
      const parentTag = (el as { tagName?: string }).tagName ?? 'list';
      $(el)
        .children()
        .each((__, child) => {
          const tag = ((child as { tagName?: string }).tagName ?? '').toLowerCase();
          if (ALLOWED_IN_LIST.has(tag)) return;
          issues.push({ problem: 'non-list-child', detail: `<${tag}> directly inside <${parentTag}>` });
        });
    });

    $('li').each((_, el) => {
      const parentTag = ($(el).parent().get(0) as { tagName?: string } | undefined)?.tagName;
      const parent = (parentTag ?? '').toLowerCase();
      if (parent === 'ul' || parent === 'ol' || parent === 'menu') return;
      issues.push({ problem: 'orphan-li', detail: `<li> inside <${parent || 'nothing'}>` });
    });

    // <dt>/<dd> must be grouped by a <dl>, optionally wrapped in a <div>.
    $('dt, dd').each((_, el) => {
      const tag = ((el as { tagName?: string }).tagName ?? '').toLowerCase();
      if ($(el).closest('dl').length > 0) return;
      issues.push({ problem: 'orphan-definition', detail: `<${tag}> outside any <dl>` });
    });

    const details = { url, issues: issues.slice(0, 25), total: issues.length };

    if (issues.length > 0) {
      return fail('a11y-list-structure', `${issues.length} list structure problem(s) found`, details);
    }

    return pass('a11y-list-structure', 'List markup is well-formed', details);
  },
});
