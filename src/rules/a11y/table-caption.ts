import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn } from '../define-rule.js';

/**
 * Rule: Check data tables are captioned properly
 *
 * A caption is how a screen reader user decides whether a table is worth
 * exploring. A full-width first row styled to look like a title serves sighted
 * users only — to assistive technology it is just a data row.
 */
export const tableCaptionRule = defineRule({
  id: 'a11y-table-caption',
  name: 'Table Captions',
  description: 'Checks that data tables use <caption> rather than a spanning cell',
  category: 'a11y',
  weight: 3,
  run: (context: AuditContext) => {
    const { $, url } = context;

    const issues: { problem: string; detail: string }[] = [];
    let dataTables = 0;

    $('table').each((_, el) => {
      const $table = $(el);
      // Layout tables carry no data semantics and need no caption.
      if ($table.attr('role') === 'presentation' || $table.attr('role') === 'none') return;

      const rows = $table.find('tr').length;
      const cols = $table.find('tr').first().children().length;
      // Below this size a "table" is usually layout scaffolding.
      if (rows < 2 || cols < 2) return;
      dataTables++;

      const hasCaption = $table.children('caption').text().trim().length > 0;

      // A first row whose only cell spans the table is a caption in disguise.
      const $firstRowCells = $table.find('tr').first().children();
      const spanning =
        $firstRowCells.length === 1 && Number($firstRowCells.first().attr('colspan') ?? 0) > 1;

      if (!hasCaption && spanning) {
        issues.push({ problem: 'fake-caption', detail: 'first row spans the table instead of using <caption>' });
      } else if (!hasCaption) {
        issues.push({ problem: 'no-caption', detail: `${rows}x${cols} data table has no <caption>` });
      }

      const summary = $table.attr('summary')?.trim();
      if (summary && hasCaption && normaliseText(summary) === normaliseText($table.children('caption').text())) {
        issues.push({ problem: 'duplicate-summary', detail: 'summary attribute repeats the caption' });
      }
    });

    const details = { url, dataTables, issues };

    if (issues.length > 0) {
      return warn(
        'a11y-table-caption',
        `${issues.length} of ${dataTables} data table(s) have caption problems`,
        details
      );
    }

    return pass(
      'a11y-table-caption',
      dataTables > 0 ? `All ${dataTables} data table(s) are captioned` : 'No data tables on the page',
      details
    );
  },
});

function normaliseText(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}
