import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, fail } from '../define-rule.js';

interface ScrollIssue {
  /** Element description */
  element: string;
  /** Issue type */
  issue: string;
  /** CSS or attribute causing the issue */
  cause: string;
}

/**
 * Rule: Horizontal Scroll
 *
 * Identifies elements that may cause horizontal scrolling on mobile devices.
 * Horizontal scrolling degrades UX and fails Google's mobile-friendly test.
 *
 * Detects:
 * - Fixed-width elements exceeding typical mobile viewport (360-414px)
 * - Images without responsive constraints (max-width: 100%)
 * - Tables without overflow handling
 * - Elements with explicit pixel widths > 400px
 * - Pre/code blocks without overflow handling
 * - Iframes with fixed dimensions
 */
export const horizontalScrollRule = defineRule({
  id: 'mobile-horizontal-scroll',
  name: 'Horizontal Scroll',
  description: 'Checks for elements that may cause horizontal scrolling on mobile',
  category: 'mobile',
  weight: 15,
  run: (context: AuditContext) => {
    const { $ } = context;

    const issues: ScrollIssue[] = [];
    const MOBILE_WIDTH = 400; // Conservative mobile viewport threshold

    // Check elements with fixed width > mobile viewport
    $('[style*="width"]').each((_, el) => {
      const $el = $(el);
      const style = $el.attr('style') || '';

      const widthMatch = style.match(/(?:^|;)\s*width\s*:\s*(\d+)(px|vw)?/i);
      if (widthMatch) {
        const width = parseInt(widthMatch[1], 10);
        const unit = widthMatch[2]?.toLowerCase() || 'px';

        if (unit === 'px' && width > MOBILE_WIDTH) {
          const tag = el.tagName?.toLowerCase() || 'element';
          const id = $el.attr('id');
          const className = $el.attr('class')?.split(' ')[0];

          issues.push({
            element: id ? `${tag}#${id}` : className ? `${tag}.${className}` : tag,
            issue: 'Fixed width exceeds mobile viewport',
            cause: `width: ${width}px`,
          });
        }
      }
    });

    // Check width attributes on elements
    $('[width]').each((_, el) => {
      const $el = $(el);
      const width = $el.attr('width');

      if (width && !width.includes('%')) {
        const numWidth = parseInt(width, 10);
        if (numWidth > MOBILE_WIDTH) {
          const tag = el.tagName?.toLowerCase() || 'element';
          const src = $el.attr('src');
          const alt = $el.attr('alt');

          issues.push({
            element: alt ? `${tag}: ${alt}` : src ? `${tag}: ${src.split('/').pop()}` : tag,
            issue: 'Width attribute exceeds mobile viewport',
            cause: `width="${width}"`,
          });
        }
      }
    });

    // Check images without max-width constraints
    $('img').each((_, el) => {
      const $el = $(el);
      const style = $el.attr('style') || '';
      const width = $el.attr('width');

      // Check if image has responsive constraint
      const hasMaxWidth = style.includes('max-width');
      const hasWidth100 = style.includes('width: 100%') || style.includes('width:100%');

      if (!hasMaxWidth && !hasWidth100) {
        // Check if image has fixed large width
        if (width && !width.includes('%')) {
          const numWidth = parseInt(width, 10);
          if (numWidth > MOBILE_WIDTH) {
            const src = $el.attr('src') || 'unknown';
            const filename = src.split('/').pop()?.split('?')[0] || 'image';

            issues.push({
              element: `img: ${filename}`,
              issue: 'Large image without max-width: 100%',
              cause: `width="${width}" without responsive constraint`,
            });
          }
        }
      }
    });

    // Check tables without responsive handling
    $('table').each((_, el) => {
      const $el = $(el);
      const style = $el.attr('style') || '';
      const parentStyle = $el.parent().attr('style') || '';

      // Check if table or parent has overflow handling
      const hasOverflow =
        style.includes('overflow') ||
        parentStyle.includes('overflow') ||
        $el.parent().hasClass('table-responsive') ||
        $el.parent().css('overflow-x') === 'auto';

      // Check if table has fixed width
      const tableWidth = style.match(/width\s*:\s*(\d+)px/i);

      if (tableWidth && parseInt(tableWidth[1], 10) > MOBILE_WIDTH && !hasOverflow) {
        issues.push({
          element: 'table',
          issue: 'Wide table without overflow handling',
          cause: `width: ${tableWidth[1]}px, no overflow-x: auto on container`,
        });
      }
    });

    // Check pre/code blocks without overflow
    $('pre, code').each((_, el) => {
      const $el = $(el);
      const style = $el.attr('style') || '';
      const parentStyle = $el.parent().attr('style') || '';

      const hasOverflow =
        style.includes('overflow') ||
        style.includes('word-wrap') ||
        style.includes('white-space: pre-wrap') ||
        parentStyle.includes('overflow');

      // Pre blocks often cause horizontal scroll
      if (el.tagName?.toLowerCase() === 'pre' && !hasOverflow) {
        const textLength = $el.text().length;
        // Only flag if content is substantial
        if (textLength > 100) {
          issues.push({
            element: 'pre',
            issue: 'Pre-formatted block may cause horizontal scroll',
            cause: 'No overflow-x: auto or white-space: pre-wrap',
          });
        }
      }
    });

    // Check iframes with fixed dimensions
    $('iframe').each((_, el) => {
      const $el = $(el);
      const width = $el.attr('width');
      const style = $el.attr('style') || '';

      const styleWidth = style.match(/width\s*:\s*(\d+)px/i);

      if (width && !width.includes('%')) {
        const numWidth = parseInt(width, 10);
        if (numWidth > MOBILE_WIDTH) {
          const src = $el.attr('src') || 'unknown';

          issues.push({
            element: `iframe: ${new URL(src, 'http://example.com').hostname}`,
            issue: 'Iframe with fixed width exceeds mobile viewport',
            cause: `width="${width}"`,
          });
        }
      } else if (styleWidth && parseInt(styleWidth[1], 10) > MOBILE_WIDTH) {
        issues.push({
          element: 'iframe',
          issue: 'Iframe with fixed width exceeds mobile viewport',
          cause: styleWidth[0],
        });
      }
    });

    // Check for viewport units that might cause issues
    $('[style*="100vw"]').each((_, el) => {
      const $el = $(el);
      const style = $el.attr('style') || '';

      // 100vw can cause horizontal scroll due to scrollbar width
      if (style.includes('width: 100vw') || style.includes('width:100vw')) {
        const tag = el.tagName?.toLowerCase() || 'element';
        issues.push({
          element: tag,
          issue: '100vw may cause horizontal scroll due to scrollbar',
          cause: 'width: 100vw (use 100% instead)',
        });
      }
    });

    // Evaluate results
    if (issues.length === 0) {
      return pass(
        'mobile-horizontal-scroll',
        'No elements likely to cause horizontal scrolling detected',
        { note: 'Static analysis - test on actual mobile devices' }
      );
    }

    // Critical issues: images and iframes are most impactful
    const criticalCount = issues.filter(i =>
      i.element.startsWith('img') || i.element.startsWith('iframe')
    ).length;

    if (criticalCount >= 3 || issues.length >= 5) {
      return fail(
        'mobile-horizontal-scroll',
        `Found ${issues.length} element(s) that may cause horizontal scrolling`,
        {
          issues: issues.slice(0, 10),
          totalIssues: issues.length,
          recommendation:
            'Use max-width: 100% on images, overflow-x: auto on tables, responsive iframes',
        }
      );
    }

    return warn(
      'mobile-horizontal-scroll',
      `Found ${issues.length} potential horizontal scroll issue(s)`,
      {
        issues: issues.slice(0, 10),
        totalIssues: issues.length,
        recommendation:
          'Add max-width: 100% to images, wrap tables in overflow containers',
      }
    );
  },
});
