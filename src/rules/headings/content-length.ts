import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn } from '../define-rule.js';

const MIN_LENGTH = 10;
const MAX_LENGTH = 70;

interface HeadingLengthInfo {
  level: number;
  text: string;
  length: number;
  issue?: 'too-short' | 'too-long';
}

/**
 * Rule: Check headings aren't too short (<10 chars) or too long (>70 chars)
 */
export const contentLengthRule = defineRule({
  id: 'headings-content-length',
  name: 'Heading Content Length',
  description: `Checks that headings are between ${MIN_LENGTH} and ${MAX_LENGTH} characters`,
  category: 'headings',
  weight: 1,
  run: async (context: AuditContext) => {
    const { $ } = context;
    const headingsInfo: HeadingLengthInfo[] = [];
    const issues: HeadingLengthInfo[] = [];

    $('h1, h2, h3, h4, h5, h6').each((_, el) => {
      const tagName = el.tagName?.toLowerCase() || '';
      const level = parseInt(tagName.replace('h', ''), 10);
      const text = $(el).text().trim();
      const length = text.length;

      const info: HeadingLengthInfo = { level, text, length };

      if (length < MIN_LENGTH && length > 0) {
        info.issue = 'too-short';
        issues.push(info);
      } else if (length > MAX_LENGTH) {
        info.issue = 'too-long';
        issues.push(info);
      }

      headingsInfo.push(info);
    });

    if (headingsInfo.length === 0) {
      return pass('headings-content-length', 'No headings found to check', {
        headingCount: 0,
      });
    }

    if (issues.length > 0) {
      const tooShort = issues.filter((i) => i.issue === 'too-short').length;
      const tooLong = issues.filter((i) => i.issue === 'too-long').length;

      const messageParts: string[] = [];
      if (tooShort > 0) {
        messageParts.push(`${tooShort} too short (<${MIN_LENGTH} chars)`);
      }
      if (tooLong > 0) {
        messageParts.push(`${tooLong} too long (>${MAX_LENGTH} chars)`);
      }

      return warn(
        'headings-content-length',
        `Heading length issues: ${messageParts.join(', ')}`,
        {
          headingCount: headingsInfo.length,
          issueCount: issues.length,
          tooShort,
          tooLong,
          issues: issues.map((i) => ({
            level: i.level,
            text: i.text.substring(0, 80) + (i.text.length > 80 ? '...' : ''),
            length: i.length,
            issue: i.issue,
          })),
          minLength: MIN_LENGTH,
          maxLength: MAX_LENGTH,
        }
      );
    }

    return pass(
      'headings-content-length',
      `All ${headingsInfo.length} headings have appropriate length`,
      {
        headingCount: headingsInfo.length,
        minLength: MIN_LENGTH,
        maxLength: MAX_LENGTH,
      }
    );
  },
});
