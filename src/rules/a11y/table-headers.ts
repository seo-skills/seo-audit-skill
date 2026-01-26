import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, fail } from '../define-rule.js';

interface TableIssue {
  /** Table identifier */
  table: string;
  /** Issue description */
  issue: string;
  /** Number of rows in table */
  rows: number;
  /** Number of columns in table */
  cols: number;
}

/**
 * Rule: Table Headers
 *
 * Checks that data tables have proper header cells (<th>) with scope attributes.
 *
 * Requirements:
 * - Data tables should have <th> elements for headers
 * - <th> should have scope="col" or scope="row"
 * - Complex tables should use id/headers attributes
 * - Layout tables should use role="presentation"
 */
export const tableHeadersRule = defineRule({
  id: 'a11y-table-headers',
  name: 'Table Headers',
  description: 'Checks that data tables have proper headers',
  category: 'a11y',
  weight: 6,
  run: (context: AuditContext) => {
    const { $ } = context;

    const issues: TableIssue[] = [];
    const tables: Array<{ hasHeaders: boolean; isLayout: boolean }> = [];

    $('table').each((index, el) => {
      const $table = $(el);

      // Check if marked as layout table
      const role = $table.attr('role');
      const isLayoutTable =
        role === 'presentation' || role === 'none' || $table.hasClass('layout');

      // Get table dimensions
      const rows = $table.find('tr').length;
      const cols = $table.find('tr').first().find('td, th').length;

      // Skip very small tables or layout tables
      if (isLayoutTable) {
        tables.push({ hasHeaders: true, isLayout: true });
        return;
      }

      // Skip 1-row or 1-col tables (likely not data tables)
      if (rows <= 1 || cols <= 1) {
        return;
      }

      const tableId = $table.attr('id') || `table-${index + 1}`;
      const $headers = $table.find('th');

      // Check for any headers
      if ($headers.length === 0) {
        issues.push({
          table: tableId,
          issue: 'No header cells (<th>) found',
          rows,
          cols,
        });
        tables.push({ hasHeaders: false, isLayout: false });
        return;
      }

      tables.push({ hasHeaders: true, isLayout: false });

      // Check for scope attributes
      let headersWithScope = 0;
      let headersWithoutScope = 0;

      $headers.each((_, th) => {
        const $th = $(th);
        const scope = $th.attr('scope');

        if (scope === 'col' || scope === 'row' || scope === 'colgroup' || scope === 'rowgroup') {
          headersWithScope++;
        } else {
          headersWithoutScope++;
        }
      });

      if (headersWithoutScope > 0 && rows > 2) {
        issues.push({
          table: tableId,
          issue: `${headersWithoutScope} header(s) missing scope attribute`,
          rows,
          cols,
        });
      }

      // Check for caption or aria-label
      const hasCaption = $table.find('caption').length > 0;
      const hasAriaLabel = !!$table.attr('aria-label') || !!$table.attr('aria-labelledby');

      if (!hasCaption && !hasAriaLabel && rows > 5) {
        issues.push({
          table: tableId,
          issue: 'Large table without caption or aria-label',
          rows,
          cols,
        });
      }

      // Check for complex tables needing id/headers
      const hasRowHeaders = $table.find('tr th').length > 1;
      const hasComplexStructure = $table.find('[colspan], [rowspan]').length > 0;

      if (hasComplexStructure && !$table.find('[headers]').length) {
        // Complex table without headers attribute
        issues.push({
          table: tableId,
          issue: 'Complex table (colspan/rowspan) may need id/headers attributes',
          rows,
          cols,
        });
      }
    });

    const dataTables = tables.filter((t) => !t.isLayout);
    const tablesWithHeaders = dataTables.filter((t) => t.hasHeaders).length;

    if (dataTables.length === 0) {
      return pass('a11y-table-headers', 'No data tables found on page', {
        layoutTables: tables.filter((t) => t.isLayout).length,
      });
    }

    if (issues.length === 0) {
      return pass('a11y-table-headers', 'All data tables have proper headers', {
        dataTables: dataTables.length,
        tablesWithHeaders,
      });
    }

    const noHeaderIssues = issues.filter((i) => i.issue.includes('No header'));

    if (noHeaderIssues.length > 0) {
      return fail(
        'a11y-table-headers',
        `${noHeaderIssues.length} table(s) missing header cells`,
        {
          issues: issues.slice(0, 10),
          dataTables: dataTables.length,
        }
      );
    }

    return warn(
      'a11y-table-headers',
      `Found ${issues.length} table accessibility issue(s)`,
      {
        issues,
        dataTables: dataTables.length,
        tablesWithHeaders,
      }
    );
  },
});
