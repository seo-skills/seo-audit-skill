import type { AuditContext } from '../../types.js';
import { defineRule, pass, fail } from '../define-rule.js';

/**
 * Rule: Fixed Viewport Width
 *
 * Detects viewport meta tags that set a fixed pixel width (e.g., width=1024)
 * instead of using device-width. A fixed width forces mobile browsers to scale
 * the page down, producing a zoomed-out desktop layout that is difficult to
 * read and interact with on small screens.
 *
 * The correct value is width=device-width, which adapts the layout viewport
 * to the actual screen width of the device.
 */
export const viewportWidthRule = defineRule({
  id: 'mobile-viewport-width',
  name: 'Viewport Fixed Width',
  description: 'Checks if viewport meta tag sets a fixed width instead of device-width',
  category: 'mobile',
  weight: 10,
  run: (context: AuditContext) => {
    const { $ } = context;

    const viewport = $('meta[name="viewport"]').attr('content');

    // No viewport tag - handled by the viewport-present rule
    if (!viewport) {
      return pass(
        'mobile-viewport-width',
        'No viewport meta tag present; skipping width check (handled by viewport-present rule)',
        { viewportFound: false }
      );
    }

    // Parse the width directive from the viewport content
    const widthMatch = viewport.match(/width\s*=\s*([^\s,;]+)/i);

    if (!widthMatch) {
      return pass(
        'mobile-viewport-width',
        'Viewport meta tag does not specify a width directive',
        { viewportContent: viewport }
      );
    }

    const widthValue = widthMatch[1].trim().toLowerCase();

    // device-width is the correct responsive value
    if (widthValue === 'device-width') {
      return pass(
        'mobile-viewport-width',
        'Viewport width is set to device-width (responsive)',
        { viewportContent: viewport, widthValue }
      );
    }

    // Check if the value is a number (fixed pixel width)
    const numericWidth = parseInt(widthValue, 10);

    if (!isNaN(numericWidth)) {
      return fail(
        'mobile-viewport-width',
        `Viewport sets a fixed width of ${numericWidth}px instead of device-width; mobile browsers will scale the page down`,
        {
          viewportContent: viewport,
          widthValue,
          fixedWidth: numericWidth,
          recommendation: 'Change width to device-width: <meta name="viewport" content="width=device-width, initial-scale=1">',
        }
      );
    }

    // Unknown value that is not device-width
    return pass(
      'mobile-viewport-width',
      `Viewport width is set to "${widthValue}"`,
      { viewportContent: viewport, widthValue }
    );
  },
});
