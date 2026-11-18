/**
 * Custom checks for every report format: one line per search, and the values
 * each extraction pulled, page by page.
 */
import type { AuditResult } from '../types.js';
import type { CustomResults } from '../custom/custom-checks.js';

export interface CustomSearchRow {
  name: string;
  /** pass, fail or warn as the search's severity says; stopped when the time limit cut it short */
  outcome: 'pass' | 'warn' | 'fail' | 'stopped' | 'unchecked';
  summary: string;
  failingPages: string[];
}

/** The run's custom results, or null when it had none */
export function customResults(result: AuditResult): CustomResults | null {
  const custom = result.extras?.custom;
  if (!custom || (custom.searches.length === 0 && custom.extractions.length === 0)) return null;
  return custom;
}

export function customSearchRows(custom: CustomResults): CustomSearchRow[] {
  return custom.searches.map((search) => {
    const expectation = search.expect === 'present' ? 'expected present' : 'expected absent';
    const stopped = search.stopped > 0 ? `; stopped by the time limit on ${search.stopped}` : '';
    if (search.checked === 0 && search.stopped === 0) {
      return { name: search.name, outcome: 'unchecked', summary: `no page in scope (${expectation})`, failingPages: [] };
    }
    if (search.failing > 0) {
      return {
        name: search.name,
        outcome: search.severity,
        summary: `${search.failing} of ${search.checked} pages fail (${expectation})${stopped}`,
        failingPages: search.failingPages,
      };
    }
    return {
      name: search.name,
      outcome: search.stopped > 0 ? 'stopped' : 'pass',
      summary: `${search.checked} page${search.checked === 1 ? '' : 's'} pass (${expectation})${stopped}`,
      failingPages: [],
    };
  });
}
