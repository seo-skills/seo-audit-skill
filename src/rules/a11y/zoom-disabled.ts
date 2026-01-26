import type { AuditContext } from '../../types.js';
import { defineRule, pass, fail } from '../define-rule.js';

/**
 * Rule: Zoom Disabled
 *
 * Checks if the viewport meta tag disables user zoom.
 * Preventing zoom is a WCAG 2.1 failure (SC 1.4.4 Resize Text).
 *
 * Problematic patterns:
 * - user-scalable=no or user-scalable=0
 * - maximum-scale=1.0 (or less)
 * - minimum-scale=1.0 combined with maximum-scale=1.0
 *
 * These prevent users with low vision from zooming to read content.
 */
export const zoomDisabledRule = defineRule({
  id: 'a11y-zoom-disabled',
  name: 'Zoom Disabled',
  description: 'Checks if viewport meta tag disables user zoom',
  category: 'a11y',
  weight: 10,
  run: (context: AuditContext) => {
    const { $ } = context;

    const viewport = $('meta[name="viewport"]');

    if (viewport.length === 0) {
      return pass('a11y-zoom-disabled', 'No viewport meta tag found', {
        note: 'Consider adding viewport meta tag for mobile optimization',
      });
    }

    const content = viewport.attr('content') || '';
    const issues: string[] = [];

    // Parse viewport content
    const directives = parseViewportContent(content);

    // Check for user-scalable=no
    if (directives['user-scalable'] === 'no' || directives['user-scalable'] === '0') {
      issues.push('user-scalable=no prevents zooming');
    }

    // Check for maximum-scale <= 1
    const maxScale = parseFloat(directives['maximum-scale'] || '10');
    if (!isNaN(maxScale) && maxScale <= 1) {
      issues.push(`maximum-scale=${maxScale} prevents zoom beyond 100%`);
    }

    // Check for minimum-scale = maximum-scale = 1 (locked zoom)
    const minScale = parseFloat(directives['minimum-scale'] || '0');
    if (!isNaN(minScale) && !isNaN(maxScale) && minScale === 1 && maxScale === 1) {
      if (!issues.some((i) => i.includes('maximum-scale'))) {
        issues.push('Zoom is locked at 100% (minimum-scale and maximum-scale both 1)');
      }
    }

    if (issues.length === 0) {
      return pass('a11y-zoom-disabled', 'Viewport allows user zoom', {
        viewport: content,
        userScalable: directives['user-scalable'] || 'yes (default)',
        maximumScale: directives['maximum-scale'] || 'not set',
      });
    }

    return fail('a11y-zoom-disabled', 'Viewport meta tag prevents user zoom', {
      viewport: content,
      issues,
      wcagReference: 'WCAG 2.1 SC 1.4.4 Resize Text (Level AA)',
      recommendation:
        'Remove user-scalable=no and ensure maximum-scale > 1 (or remove it entirely)',
      fixedViewport: 'width=device-width, initial-scale=1',
    });
  },
});

/**
 * Parse viewport content string into key-value pairs
 */
function parseViewportContent(content: string): Record<string, string> {
  const directives: Record<string, string> = {};

  // Split by comma or semicolon
  const parts = content.split(/[,;]/);

  for (const part of parts) {
    const [key, value] = part.split('=').map((s) => s.trim().toLowerCase());
    if (key) {
      directives[key] = value || '';
    }
  }

  return directives;
}
