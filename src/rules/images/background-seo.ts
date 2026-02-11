import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, fail } from '../define-rule.js';

interface BackgroundImageItem {
  /** HTML tag name */
  tag: string;
  /** The background-image URL extracted from the style */
  url: string;
  /** Whether the element is in a semantically important container */
  isImportant: boolean;
}

/** Tags that commonly contain important visual content */
const IMPORTANT_CONTAINERS = new Set([
  'header',
  'main',
  'article',
  'section',
  'hero',
  'banner',
]);

/** Maximum count before it becomes a fail */
const WARN_THRESHOLD = 2;
const FAIL_THRESHOLD = 5;

/**
 * Rule: Background Images SEO
 *
 * Detects important images loaded as CSS background images via inline styles.
 * Search engine crawlers cannot index background images because they are CSS
 * properties rather than HTML content. Important visual content (hero images,
 * product photos, article illustrations) should use <img> tags with alt text
 * to be discoverable by search engines and accessible to screen readers.
 *
 * This rule checks inline style attributes for background-image declarations.
 * Note: External CSS background images cannot be detected through static HTML analysis.
 */
export const backgroundSeoRule = defineRule({
  id: 'images-background-seo',
  name: 'Background Images SEO',
  description: 'Checks for important images loaded as CSS background images (not crawlable by search engines)',
  category: 'images',
  weight: 5,
  run: (context: AuditContext) => {
    const { $ } = context;

    const found: BackgroundImageItem[] = [];

    // Find all elements with inline background-image styles
    $('[style*="background-image"]').each((_, el) => {
      const $el = $(el);
      const style = $el.attr('style') || '';
      const tag = el.tagName?.toLowerCase() || 'unknown';

      // Extract URL from background-image: url(...)
      const urlMatch = style.match(/background-image\s*:\s*url\s*\(\s*['"]?([^'")]+)['"]?\s*\)/i);
      if (!urlMatch) {
        return;
      }

      const bgUrl = urlMatch[1].trim();

      // Skip data URIs and gradients (not real image content)
      if (bgUrl.startsWith('data:') || bgUrl.startsWith('linear-gradient') || bgUrl.startsWith('radial-gradient')) {
        return;
      }

      // Check if element is in an important container
      const isImportant =
        IMPORTANT_CONTAINERS.has(tag) ||
        $el.closest('header, main, article, section, [role="banner"], [role="main"]').length > 0;

      found.push({ tag, url: bgUrl, isImportant });
    });

    if (found.length === 0) {
      return pass(
        'images-background-seo',
        'No inline CSS background images detected',
        { count: 0 }
      );
    }

    // Count important vs general background images
    const importantCount = found.filter((item) => item.isImportant).length;

    const details = {
      totalCount: found.length,
      importantCount,
      examples: found.slice(0, 10).map((item) => ({
        tag: item.tag,
        url: item.url.length > 80 ? item.url.substring(0, 77) + '...' : item.url,
        isImportant: item.isImportant,
      })),
      recommendation: 'Use <img> tags with descriptive alt text for important visual content instead of CSS background-image',
    };

    if (found.length <= 1) {
      return pass(
        'images-background-seo',
        `Found ${found.length} inline CSS background image (minimal usage)`,
        details
      );
    }

    if (found.length > FAIL_THRESHOLD) {
      return fail(
        'images-background-seo',
        `Found ${found.length} inline CSS background images; significant visual content may be invisible to search engine crawlers`,
        details
      );
    }

    if (found.length >= WARN_THRESHOLD) {
      return warn(
        'images-background-seo',
        `Found ${found.length} inline CSS background images; these are not indexable by search engines`,
        details
      );
    }

    return pass(
      'images-background-seo',
      `Found ${found.length} inline CSS background image(s) (minimal usage)`,
      details
    );
  },
});
