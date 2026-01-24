import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn } from '../define-rule.js';

/**
 * Rule: Check for content freshness signals
 *
 * Checks for:
 * - Schema.org datePublished/dateModified in JSON-LD
 * - <time> element with datetime attribute
 * - article:published_time / article:modified_time meta tags
 * - Last-Modified HTTP header
 */
export const freshnessRule = defineRule({
  id: 'content-freshness',
  name: 'Content Freshness',
  description: 'Checks for date signals that indicate content freshness',
  category: 'content',
  weight: 3,
  run: async (context: AuditContext) => {
    const { $, headers } = context;
    const signals: { type: string; value: string }[] = [];

    // 1. Check for Schema.org dates in JSON-LD
    const jsonLdScripts = $('script[type="application/ld+json"]');

    jsonLdScripts.each((_, el) => {
      try {
        const content = $(el).html();
        if (content) {
          const data = JSON.parse(content);

          const checkDates = (obj: unknown): void => {
            if (!obj || typeof obj !== 'object') return;
            const record = obj as Record<string, unknown>;

            if (record.datePublished && typeof record.datePublished === 'string') {
              signals.push({ type: 'Schema.org datePublished', value: record.datePublished });
            }
            if (record.dateModified && typeof record.dateModified === 'string') {
              signals.push({ type: 'Schema.org dateModified', value: record.dateModified });
            }

            // Check @graph array
            if (Array.isArray(record['@graph'])) {
              for (const item of record['@graph']) {
                checkDates(item);
              }
            }
          };

          checkDates(data);
        }
      } catch {
        // Invalid JSON, skip
      }
    });

    // 2. Check for <time> elements with datetime
    const timeElements = $('time[datetime]');
    timeElements.each((_, el) => {
      const datetime = $(el).attr('datetime');
      if (datetime) {
        signals.push({ type: 'HTML time element', value: datetime });
      }
    });

    // 3. Check for Open Graph article dates
    const ogPublished = $('meta[property="article:published_time"]').attr('content');
    if (ogPublished) {
      signals.push({ type: 'article:published_time', value: ogPublished });
    }

    const ogModified = $('meta[property="article:modified_time"]').attr('content');
    if (ogModified) {
      signals.push({ type: 'article:modified_time', value: ogModified });
    }

    // 4. Check for Last-Modified header
    const lastModified = headers['last-modified'] || headers['Last-Modified'];
    if (lastModified) {
      signals.push({ type: 'Last-Modified header', value: lastModified });
    }

    // 5. Check for common date patterns in page content
    const dateClasses = ['.published', '.date', '.post-date', '.entry-date', '[class*="date"]'];
    for (const selector of dateClasses) {
      const element = $(selector).first();
      if (element.length > 0) {
        const text = element.text().trim();
        // Basic date pattern check (avoid false positives)
        if (text && text.length < 50 && /\d{1,4}[-/]\d{1,2}[-/]\d{1,4}|\w+\s+\d{1,2},?\s+\d{4}/i.test(text)) {
          signals.push({ type: `Visible date (${selector})`, value: text });
          break;
        }
      }
    }

    if (signals.length > 0) {
      // Deduplicate by type
      const uniqueSignals = signals.filter(
        (signal, index, arr) => arr.findIndex((s) => s.type === signal.type) === index
      );

      return pass(
        'content-freshness',
        `Content freshness signals found (${uniqueSignals.length} type${uniqueSignals.length > 1 ? 's' : ''})`,
        {
          signals: uniqueSignals,
          recommendation: 'Update dateModified when making significant content changes',
        }
      );
    }

    return warn('content-freshness', 'No content freshness signals found', {
      signals: [],
      recommendation:
        'Add datePublished and dateModified to Article schema, or use <time> elements with datetime attributes',
      impact:
        'Search engines use date signals to assess content freshness, which can affect rankings for time-sensitive queries',
    });
  },
});
