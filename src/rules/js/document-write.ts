import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn } from '../define-rule.js';

/**
 * `document.write(` / `document.writeln(`, allowing whitespace around the dot.
 * The group must be `(?:ln)?` — `writeln?` would require "writel" and so miss
 * every plain `document.write` call.
 */
const DOCUMENT_WRITE_PATTERN = /document\s*\.\s*write(?:ln)?\s*\(/g;

/**
 * Rule: Detect document.write() in inline scripts
 *
 * `document.write` executed during parsing forces the browser to stop, run the
 * injected content, and resume — which is why it delays first paint badly on
 * slow connections. Chrome already intervenes and refuses to honour it for
 * cross-origin scripts on 2G.
 */
export const documentWriteRule = defineRule({
  id: 'js-document-write',
  name: 'No document.write()',
  description: 'Checks that inline scripts do not use document.write()',
  category: 'js',
  weight: 7,
  run: (context: AuditContext) => {
    const { $, url } = context;

    const occurrences: { snippet: string; count: number }[] = [];

    $('script:not([src])').each((_, el) => {
      const source = $(el).text();
      if (!source) return;

      const matches = source.match(DOCUMENT_WRITE_PATTERN);
      if (!matches) return;

      // Show the call in context so the location is findable in the source.
      const index = source.search(DOCUMENT_WRITE_PATTERN);
      occurrences.push({
        snippet: source.slice(Math.max(0, index - 20), index + 60).replace(/\s+/g, ' ').trim(),
        count: matches.length,
      });
    });

    const total = occurrences.reduce((sum, o) => sum + o.count, 0);
    const details = { url, occurrences, total };

    if (total > 0) {
      return warn(
        'js-document-write',
        `${total} document.write() call(s) found in ${occurrences.length} inline script(s). This blocks the parser and delays first paint.`,
        details
      );
    }

    return pass('js-document-write', 'No document.write() calls in inline scripts', details);
  },
});
