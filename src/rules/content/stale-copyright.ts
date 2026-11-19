import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn } from '../define-rule.js';

/** A copyright marker followed by a year, or by a range whose end year counts. */
const COPYRIGHT = /(?:©|\(c\)|copyright)\s*(\d{4})(?:\s*[-–—]\s*(\d{4}))?/gi;

/**
 * Rule: Stale footer copyright year
 *
 * An old year in the footer is a cheap signal the site has not been touched.
 * Body copy that mentions a year is left alone; only footer and
 * role=contentinfo are read.
 */
export const staleCopyrightRule = defineRule({
  id: 'content-stale-copyright',
  name: 'Stale Copyright Year',
  description: 'Warns when the copyright year in the footer has not been updated',
  category: 'content',
  weight: 2,
  run: (context: AuditContext) => {
    const currentYear = new Date().getFullYear();
    const footer = context.$('footer, [role="contentinfo"]').text();
    const years: number[] = [];

    for (const match of footer.matchAll(COPYRIGHT)) {
      years.push(Number(match[2] ?? match[1]));
    }

    if (years.length === 0) {
      return pass('content-stale-copyright', 'No footer copyright year to compare', {
        currentYear,
        years: [],
      });
    }

    const stale = years.filter((year) => year < currentYear);
    if (stale.length === 0) {
      return pass('content-stale-copyright', `Footer copyright year is current (${currentYear})`, {
        currentYear,
        years,
      });
    }

    return warn(
      'content-stale-copyright',
      `Footer copyright year ${stale.join(', ')} is behind ${currentYear}`,
      {
        currentYear,
        years,
        recommendation: `Update the footer copyright to ${currentYear}.`,
      }
    );
  },
});
