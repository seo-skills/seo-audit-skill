import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, fail } from '../define-rule.js';

/**
 * Rule: Content Structure for AI Extraction
 *
 * Checks whether the page has a clear content structure that AI systems can
 * reliably extract and summarize. Generative engines prefer pages where the
 * main content area is clearly delineated, headings follow a logical
 * hierarchy, prose paragraphs provide context, and structured data (lists
 * or tables) organizes facts.
 *
 * Four signals are evaluated:
 * 1. Has a main content area (<main>, <article>, or [role="main"])
 * 2. Has hierarchical headings (h1 -> h2 -> h3)
 * 3. Has paragraph text (not just lists/tables)
 * 4. Has structured lists or tables for data
 *
 * Scoring:
 * - 4 signals: pass
 * - 3 signals: warn
 * - 0-2 signals: fail
 */
export const contentStructureRule = defineRule({
  id: 'geo-content-structure',
  name: 'Content Structure for AI',
  description:
    'Checks if the page has clear content structure for AI extraction (main area, heading hierarchy, paragraphs, structured data)',
  category: 'geo',
  weight: 25,
  run: (context: AuditContext) => {
    const { $ } = context;

    const signals: string[] = [];
    const missingSignals: string[] = [];

    // Signal 1: Has a main content area
    const hasMainArea =
      $('main').length > 0 ||
      $('article').length > 0 ||
      $('[role="main"]').length > 0;

    if (hasMainArea) {
      signals.push('main content area');
    } else {
      missingSignals.push('main content area (<main>, <article>, or [role="main"])');
    }

    // Signal 2: Has hierarchical headings (h1 -> h2 -> h3)
    const headings: number[] = [];
    $('h1, h2, h3, h4, h5, h6').each((_, el) => {
      const tagName = el.tagName?.toLowerCase() || '';
      const level = parseInt(tagName.replace('h', ''), 10);
      if (!isNaN(level)) {
        headings.push(level);
      }
    });

    // Check that we have at least two different heading levels in descending order
    const uniqueLevels = [...new Set(headings)].sort((a, b) => a - b);
    const hasHierarchy = uniqueLevels.length >= 2 && uniqueLevels[0] <= 2;

    if (hasHierarchy) {
      signals.push('hierarchical headings');
    } else {
      missingSignals.push(
        'hierarchical headings (h1 followed by h2, h3, etc.)'
      );
    }

    // Signal 3: Has paragraph text (not just lists/tables)
    const paragraphs = $('p');
    let totalParagraphWords = 0;
    paragraphs.each((_, el) => {
      const text = $(el).text().trim();
      if (text.length > 0) {
        totalParagraphWords += text.split(/\s+/).length;
      }
    });

    const hasParagraphs = totalParagraphWords >= 30;

    if (hasParagraphs) {
      signals.push('paragraph content');
    } else {
      missingSignals.push(
        'paragraph content (at least 30 words of prose in <p> elements)'
      );
    }

    // Signal 4: Has structured lists or tables for data
    const hasLists = $('ul, ol, dl').length > 0;
    const hasTables = $('table').length > 0;
    const hasStructuredData = hasLists || hasTables;

    if (hasStructuredData) {
      signals.push('structured data (lists/tables)');
    } else {
      missingSignals.push('structured data (<ul>, <ol>, <dl>, or <table> elements)');
    }

    const signalCount = signals.length;

    const details: Record<string, unknown> = {
      presentSignals: signals,
      missingSignals,
      signalCount,
      headingLevels: uniqueLevels,
      paragraphWordCount: totalParagraphWords,
      hasLists,
      hasTables,
    };

    if (signalCount === 4) {
      return pass(
        'geo-content-structure',
        'Page has excellent content structure for AI extraction (all 4 signals present)',
        details
      );
    }

    if (signalCount === 3) {
      return warn(
        'geo-content-structure',
        `Good content structure (${signalCount}/4 signals). Missing: ${missingSignals.join('; ')}`,
        details
      );
    }

    return fail(
      'geo-content-structure',
      `Poor content structure for AI extraction (${signalCount}/4 signals). Missing: ${missingSignals.join('; ')}`,
      {
        ...details,
        recommendation:
          'Add a clear <main> or <article> area, use hierarchical headings, write paragraph prose, and include lists or tables for structured information',
      }
    );
  },
});
