import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, fail, notMeasured } from '../define-rule.js';

/**
 * Console noise that says nothing about the page's own health.
 *
 * Browser extensions, ad blockers and privacy tooling inject scripts that log
 * into the page's console, and third-party tags routinely warn about
 * deprecations the site cannot act on. Reporting those as page defects trains
 * people to ignore the rule.
 */
const IGNORABLE_PATTERNS: RegExp[] = [
  /^Failed to load resource/i, // covered in detail by js-failed-requests
  /chrome-extension:\/\//i,
  /moz-extension:\/\//i,
  /\[Intervention\]/i,
  /was preloaded using link preload but not used/i,
  /Tracking Prevention blocked/i,
  /Third-party cookie will be blocked/i,
];

function isIgnorable(text: string): boolean {
  return IGNORABLE_PATTERNS.some((pattern) => pattern.test(text));
}

/** Trim a message for reporting without losing the identifying part */
function summarise(text: string): string {
  const oneLine = text.replace(/\s+/g, ' ').trim();
  return oneLine.length > 160 ? `${oneLine.slice(0, 157)}...` : oneLine;
}

/**
 * Rule: JavaScript Console Errors
 *
 * Reports uncaught exceptions and console errors observed while the page
 * rendered. An uncaught exception halts the script that threw it, so anything
 * later in that file never runs - which is how content, structured data or
 * canonical tags silently fail to appear for a crawler that does execute
 * JavaScript.
 *
 * This is only observable from a real browser; a static HTML parse cannot
 * report it.
 */
export const consoleErrorsRule = defineRule({
  id: 'js-console-errors',
  name: 'JavaScript Console Errors',
  description:
    'Reports uncaught JavaScript exceptions and console errors captured while rendering the page',
  category: 'js',
  weight: 8,
  run: (context: AuditContext) => {
    const diagnostics = context.renderDiagnostics;

    if (!diagnostics) {
      return notMeasured(
        'js-console-errors',
        'Rendered DOM not available - run without --no-cwv to capture JavaScript errors'
      );
    }

    const pageErrors = diagnostics.pageErrors.map(summarise);
    const consoleErrors = diagnostics.consoleMessages
      .filter((message) => message.level === 'error' && !isIgnorable(message.text))
      .map((message) => summarise(message.text));

    const details = {
      pageErrorCount: pageErrors.length,
      consoleErrorCount: consoleErrors.length,
      pageErrors: pageErrors.slice(0, 10),
      consoleErrors: consoleErrors.slice(0, 10),
    };

    // An uncaught exception is the serious case: it stops script execution.
    if (pageErrors.length > 0) {
      return fail(
        'js-console-errors',
        `${pageErrors.length} uncaught JavaScript error(s) while rendering: ${pageErrors[0]}`,
        {
          ...details,
          impact:
            'An uncaught exception halts the script that threw it, so any content, structured data or meta tags it would have written never appear to a rendering crawler.',
        }
      );
    }

    if (consoleErrors.length > 0) {
      return warn(
        'js-console-errors',
        `${consoleErrors.length} console error(s) while rendering: ${consoleErrors[0]}`,
        details
      );
    }

    return pass('js-console-errors', 'No JavaScript errors while rendering the page', details);
  },
});
