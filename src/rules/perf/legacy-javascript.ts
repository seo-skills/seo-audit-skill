import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn } from '../define-rule.js';

/**
 * Script sources that exist only to support browsers modern targets do not
 * need. Matched against the URL, so a bundle that merely *contains* polyfills
 * is not flagged — only ones that announce themselves.
 */
const LEGACY_SOURCE_PATTERNS: { pattern: RegExp; label: string }[] = [
  { pattern: /polyfill\.io/i, label: 'polyfill.io' },
  { pattern: /\bcore-js\b/i, label: 'core-js' },
  { pattern: /babel-polyfill/i, label: 'babel-polyfill' },
  { pattern: /regenerator-runtime/i, label: 'regenerator-runtime' },
  { pattern: /\bes5-shim\b/i, label: 'es5-shim' },
  { pattern: /\bes6-shim\b/i, label: 'es6-shim' },
  { pattern: /\bwhatwg-fetch\b/i, label: 'whatwg-fetch' },
  { pattern: /\bpolyfills?[-.]/i, label: 'polyfill bundle' },
];

/** Transpiler runtime markers that only appear in ES5 output */
const LEGACY_INLINE_PATTERNS: { pattern: RegExp; label: string }[] = [
  { pattern: /regeneratorRuntime/, label: 'regeneratorRuntime' },
  { pattern: /_createClass\s*\(/, label: 'Babel _createClass helper' },
  { pattern: /__extends\s*=/, label: 'TypeScript __extends helper' },
];

/**
 * Rule: Detect JavaScript shipped only for legacy browsers
 *
 * Polyfills and ES5 transpilation are dead weight for the browsers that
 * actually visit most sites — they cost download, parse and execution time to
 * serve engines that already support the features natively.
 */
export const legacyJavascriptRule = defineRule({
  id: 'perf-legacy-javascript',
  name: 'Legacy JavaScript',
  description:
    'Checks whether the page ships polyfills or transpiler runtimes modern browsers do not need',
  category: 'perf',
  weight: 5,
  run: (context: AuditContext) => {
    const { $, url } = context;

    const found = new Map<string, string>();

    $('script[src]').each((_, el) => {
      const src = $(el).attr('src');
      if (!src) return;
      for (const { pattern, label } of LEGACY_SOURCE_PATTERNS) {
        if (pattern.test(src) && !found.has(label)) found.set(label, src);
      }
    });

    $('script:not([src])').each((_, el) => {
      const source = $(el).text();
      if (!source) return;
      for (const { pattern, label } of LEGACY_INLINE_PATTERNS) {
        if (pattern.test(source) && !found.has(label)) found.set(label, 'inline script');
      }
    });

    const detected = Array.from(found, ([label, source]) => ({ label, source }));
    const details = { url, detected };

    if (detected.length > 0) {
      return warn(
        'perf-legacy-javascript',
        `Legacy JavaScript detected (${detected.map((d) => d.label).join(', ')}). Modern browsers do not need these; consider dropping them from the default bundle.`,
        details
      );
    }

    return pass('perf-legacy-javascript', 'No legacy polyfills or transpiler runtimes detected', details);
  },
});
