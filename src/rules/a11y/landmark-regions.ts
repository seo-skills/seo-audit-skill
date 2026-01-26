import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn } from '../define-rule.js';

interface LandmarkInfo {
  /** Landmark type */
  type: string;
  /** Count of this landmark type */
  count: number;
  /** Whether it has an accessible name */
  hasLabel?: boolean;
}

/**
 * Rule: Landmark Regions
 *
 * Checks for proper landmark regions that help screen reader users navigate.
 *
 * Essential landmarks:
 * - <main> or role="main" - Primary content
 * - <nav> or role="navigation" - Navigation
 * - <header> or role="banner" - Page header (when direct child of body)
 * - <footer> or role="contentinfo" - Page footer (when direct child of body)
 *
 * Additional landmarks:
 * - <aside> or role="complementary" - Related content
 * - <form> or role="form" - Forms (with accessible name)
 * - <section> or role="region" - Sections (with accessible name)
 */
export const landmarkRegionsRule = defineRule({
  id: 'a11y-landmark-regions',
  name: 'Landmark Regions',
  description: 'Checks for proper landmark regions (main, nav, header, footer)',
  category: 'a11y',
  weight: 6,
  run: (context: AuditContext) => {
    const { $ } = context;

    const landmarks: Record<string, LandmarkInfo> = {};
    const missing: string[] = [];
    const warnings: string[] = [];

    // Check for main landmark
    const mainElements = $('main, [role="main"]');
    if (mainElements.length === 0) {
      missing.push('main');
    } else {
      landmarks.main = { type: 'main', count: mainElements.length };
      if (mainElements.length > 1) {
        warnings.push('Multiple <main> landmarks found (should be only one)');
      }
    }

    // Check for navigation landmark
    const navElements = $('nav, [role="navigation"]');
    if (navElements.length === 0) {
      missing.push('navigation');
    } else {
      landmarks.navigation = { type: 'navigation', count: navElements.length };
      // Multiple navs are okay, but should have labels
      if (navElements.length > 1) {
        let labelled = 0;
        navElements.each((_, el) => {
          const $el = $(el);
          if (
            $el.attr('aria-label') ||
            $el.attr('aria-labelledby') ||
            $el.attr('title')
          ) {
            labelled++;
          }
        });
        if (labelled < navElements.length) {
          warnings.push(
            `${navElements.length} nav landmarks found; ${navElements.length - labelled} lack labels`
          );
        }
      }
    }

    // Check for header/banner (only counts if direct child of body or not inside article/section)
    const headerElements = $('body > header, [role="banner"]');
    if (headerElements.length === 0) {
      // Check for header not directly under body
      const anyHeader = $('header').length;
      if (anyHeader > 0) {
        landmarks.banner = { type: 'banner', count: anyHeader };
      } else {
        missing.push('banner/header');
      }
    } else {
      landmarks.banner = { type: 'banner', count: headerElements.length };
    }

    // Check for footer/contentinfo
    const footerElements = $('body > footer, [role="contentinfo"]');
    if (footerElements.length === 0) {
      const anyFooter = $('footer').length;
      if (anyFooter > 0) {
        landmarks.contentinfo = { type: 'contentinfo', count: anyFooter };
      } else {
        missing.push('contentinfo/footer');
      }
    } else {
      landmarks.contentinfo = { type: 'contentinfo', count: footerElements.length };
    }

    // Check for complementary (aside) - optional
    const asideElements = $('aside, [role="complementary"]');
    if (asideElements.length > 0) {
      landmarks.complementary = { type: 'complementary', count: asideElements.length };
    }

    // Check for search landmark - optional but recommended
    const searchElements = $('[role="search"]');
    if (searchElements.length > 0) {
      landmarks.search = { type: 'search', count: searchElements.length };
    }

    // Determine result
    const landmarkCount = Object.keys(landmarks).length;

    if (missing.length === 0 && warnings.length === 0) {
      return pass('a11y-landmark-regions', 'All essential landmark regions present', {
        landmarks,
        recommendation: 'Consider adding role="search" to search forms',
      });
    }

    if (missing.includes('main')) {
      // Missing main is more serious
      return warn(
        'a11y-landmark-regions',
        `Missing essential landmark: <main>. Also missing: ${missing.join(', ')}`,
        {
          missing,
          landmarks,
          warnings,
          recommendation: 'Add <main> landmark to wrap primary content',
        }
      );
    }

    // Other missing landmarks are informational
    return warn(
      'a11y-landmark-regions',
      `${missing.length} landmark region(s) missing`,
      {
        missing,
        landmarks,
        warnings,
        recommendation: 'Add landmark regions for better screen reader navigation',
      }
    );
  },
});
