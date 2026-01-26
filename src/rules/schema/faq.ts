import type { AuditContext } from '../../types.js';
import { defineRule, pass, fail } from '../define-rule.js';
import { findItemsByType, hasField } from './utils.js';

/**
 * Rule: Validate FAQPage schema structured data
 *
 * Checks for proper implementation of FAQPage schema:
 * - mainEntity must exist and be an array of Questions
 * - Each Question must have:
 *   - @type === 'Question'
 *   - name property (the question text)
 *   - acceptedAnswer property with:
 *     - @type === 'Answer'
 *     - text property
 */
export const structuredDataFaqRule = defineRule({
  id: 'schema-faq',
  name: 'FAQ Schema',
  description:
    'Validates FAQPage schema for proper Question and Answer structure with required fields',
  category: 'schema',
  weight: 8,
  run: async (context: AuditContext) => {
    const { $ } = context;

    const faqPages = findItemsByType($, 'FAQPage');

    if (faqPages.length === 0) {
      return pass(
        'schema-faq',
        'No FAQPage schema found (not required)',
        { faqPagesFound: 0 }
      );
    }

    const issues: string[] = [];
    let totalQuestions = 0;

    for (const faqPage of faqPages) {
      // Check mainEntity exists
      if (!hasField(faqPage, 'mainEntity')) {
        issues.push('FAQPage: missing mainEntity property');
        continue;
      }

      const mainEntity = faqPage.data.mainEntity;

      // mainEntity must be an array
      if (!Array.isArray(mainEntity)) {
        issues.push('FAQPage: mainEntity must be an array of Questions');
        continue;
      }

      if (mainEntity.length === 0) {
        issues.push('FAQPage: mainEntity array is empty');
        continue;
      }

      // Validate each Question
      for (let i = 0; i < mainEntity.length; i++) {
        const question = mainEntity[i] as Record<string, unknown>;
        const questionIndex = i + 1;

        // Check @type is Question
        if (question['@type'] !== 'Question') {
          issues.push(
            `FAQPage Question #${questionIndex}: @type must be "Question", found "${question['@type'] || 'missing'}"`
          );
          continue;
        }

        // Check name property (the question text)
        if (!question.name || typeof question.name !== 'string' || question.name.trim() === '') {
          issues.push(
            `FAQPage Question #${questionIndex}: missing or empty "name" property (the question text)`
          );
        }

        // Check acceptedAnswer exists
        if (!question.acceptedAnswer) {
          issues.push(
            `FAQPage Question #${questionIndex}: missing "acceptedAnswer" property`
          );
          continue;
        }

        const answer = question.acceptedAnswer as Record<string, unknown>;

        // Check acceptedAnswer @type is Answer
        if (answer['@type'] !== 'Answer') {
          issues.push(
            `FAQPage Question #${questionIndex}: acceptedAnswer @type must be "Answer", found "${answer['@type'] || 'missing'}"`
          );
        }

        // Check acceptedAnswer text property
        if (!answer.text || typeof answer.text !== 'string' || answer.text.trim() === '') {
          issues.push(
            `FAQPage Question #${questionIndex}: acceptedAnswer missing or empty "text" property`
          );
        }

        totalQuestions++;
      }
    }

    if (issues.length > 0) {
      return fail(
        'schema-faq',
        `FAQPage schema validation failed: ${issues.join('; ')}`,
        {
          faqPagesFound: faqPages.length,
          issues,
        }
      );
    }

    return pass(
      'schema-faq',
      `Valid FAQPage schema found with ${totalQuestions} question(s)`,
      {
        faqPagesFound: faqPages.length,
        questionsFound: totalQuestions,
      }
    );
  },
});
