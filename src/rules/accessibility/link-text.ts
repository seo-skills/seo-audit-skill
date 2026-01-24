import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, fail } from '../define-rule.js';

interface GenericLink {
  /** Link text */
  text: string;
  /** Link href */
  href: string;
  /** Why it's problematic */
  issue: string;
}

/**
 * Generic/vague link text patterns that don't describe the destination
 */
const GENERIC_PATTERNS = [
  /^click\s*here$/i,
  /^here$/i,
  /^read\s*more$/i,
  /^more$/i,
  /^learn\s*more$/i,
  /^see\s*more$/i,
  /^view\s*more$/i,
  /^details$/i,
  /^link$/i,
  /^this$/i,
  /^this\s*link$/i,
  /^go$/i,
  /^continue$/i,
  /^info$/i,
  /^information$/i,
  /^download$/i,
  /^pdf$/i,
];

/**
 * Links that are too short to be descriptive
 */
const MIN_LINK_LENGTH = 2;

/**
 * Rule: Link Text
 *
 * Checks for descriptive link text that makes sense out of context.
 * Screen reader users often navigate by links alone, so link text
 * should describe the destination.
 *
 * Problematic patterns:
 * - "Click here", "Read more", "Learn more" without context
 * - Single characters or very short text
 * - URLs as link text
 * - Duplicate link text pointing to different destinations
 */
export const linkTextRule = defineRule({
  id: 'a11y-link-text',
  name: 'Link Text',
  description: 'Checks for descriptive link text',
  category: 'accessibility',
  weight: 8,
  run: (context: AuditContext) => {
    const { $ } = context;

    const genericLinks: GenericLink[] = [];
    const linkTextMap = new Map<string, string[]>(); // text -> hrefs
    let totalLinks = 0;

    $('a[href]').each((_, el) => {
      const $el = $(el);
      const href = $el.attr('href') || '';
      const text = getAccessibleText($, $el).toLowerCase().trim();

      // Skip anchor links and javascript
      if (href.startsWith('#') || href.startsWith('javascript:')) {
        return;
      }

      totalLinks++;

      // Check for empty or very short text
      if (text.length < MIN_LINK_LENGTH) {
        // Check if it has aria-label
        const ariaLabel = $el.attr('aria-label')?.trim();
        if (!ariaLabel) {
          genericLinks.push({
            text: text || '(empty)',
            href: href.slice(0, 50),
            issue: 'Link text too short or empty',
          });
        }
        return;
      }

      // Check for generic patterns
      for (const pattern of GENERIC_PATTERNS) {
        if (pattern.test(text)) {
          // Check for aria-label that provides context
          const ariaLabel = $el.attr('aria-label')?.trim();
          if (!ariaLabel) {
            genericLinks.push({
              text,
              href: href.slice(0, 50),
              issue: 'Generic link text - not descriptive',
            });
          }
          break;
        }
      }

      // Check for URL as link text
      if (/^https?:\/\//i.test(text) || /^www\./i.test(text)) {
        genericLinks.push({
          text: text.slice(0, 40),
          href: href.slice(0, 50),
          issue: 'URL used as link text',
        });
      }

      // Track for duplicate detection
      const normalizedText = text.toLowerCase();
      const existing = linkTextMap.get(normalizedText) || [];
      existing.push(href);
      linkTextMap.set(normalizedText, existing);
    });

    // Check for duplicate link text with different destinations
    const duplicates: Array<{ text: string; count: number }> = [];
    for (const [text, hrefs] of linkTextMap) {
      const uniqueHrefs = new Set(hrefs.map((h) => normalizeHref(h)));
      if (uniqueHrefs.size > 1 && hrefs.length > 1) {
        duplicates.push({ text, count: hrefs.length });
      }
    }

    if (genericLinks.length === 0 && duplicates.length === 0) {
      return pass('a11y-link-text', 'All links have descriptive text', {
        totalLinks,
      });
    }

    const issues: string[] = [];

    for (const link of genericLinks.slice(0, 5)) {
      issues.push(`"${link.text}" - ${link.issue}`);
    }

    for (const dup of duplicates.slice(0, 3)) {
      issues.push(`"${dup.text}" used ${dup.count} times for different destinations`);
    }

    const totalIssues = genericLinks.length + duplicates.length;

    if (totalIssues > 5 || genericLinks.length > 3) {
      return fail(
        'a11y-link-text',
        `Found ${totalIssues} link text accessibility issue(s)`,
        {
          genericLinks: genericLinks.slice(0, 10),
          duplicates: duplicates.slice(0, 5),
          totalLinks,
          issues,
        }
      );
    }

    return warn(
      'a11y-link-text',
      `Found ${totalIssues} link text accessibility issue(s)`,
      {
        genericLinks,
        duplicates,
        totalLinks,
        issues,
      }
    );
  },
});

/**
 * Get accessible text for a link, including aria-label and image alts
 */
function getAccessibleText(
  $: cheerio.CheerioAPI,
  $el: cheerio.Cheerio<cheerio.Element>
): string {
  // aria-label takes precedence
  const ariaLabel = $el.attr('aria-label');
  if (ariaLabel) {
    return ariaLabel;
  }

  // aria-labelledby
  const labelledBy = $el.attr('aria-labelledby');
  if (labelledBy) {
    const labelText = $(`#${labelledBy}`).text();
    if (labelText) {
      return labelText;
    }
  }

  // Text content
  let text = $el.text().trim();

  // If no text, check for image alt
  if (!text) {
    const imgAlt = $el.find('img').first().attr('alt');
    if (imgAlt) {
      text = imgAlt;
    }
  }

  // Check for SVG title
  if (!text) {
    const svgTitle = $el.find('svg title').first().text();
    if (svgTitle) {
      text = svgTitle;
    }
  }

  return text;
}

/**
 * Normalize href for comparison (remove trailing slash, query params)
 */
function normalizeHref(href: string): string {
  try {
    const url = new URL(href, 'http://example.com');
    return url.pathname.replace(/\/$/, '');
  } catch {
    return href.replace(/\/$/, '');
  }
}
