import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, fail } from '../define-rule.js';

/**
 * CSS file count thresholds
 * Many CSS files = bundling opportunity
 */
const THRESHOLDS = {
  externalFiles: { good: 3, warning: 6 },
  inlineCssKb: { good: 50, warning: 100 },
};

interface CssAnalysis {
  externalCount: number;
  externalUrls: string[];
  inlineStyleCount: number;
  inlineCssBytes: number;
  hasPreloadCss: boolean;
}

/**
 * Analyze CSS usage on the page
 */
function analyzeCss($: AuditContext['$']): CssAnalysis {
  const externalUrls: string[] = [];

  // Count external stylesheets
  $('link[rel="stylesheet"]').each((_, el) => {
    const href = $(el).attr('href');
    if (href) {
      externalUrls.push(href);
    }
  });

  // Calculate inline CSS size
  let inlineCssBytes = 0;
  let inlineStyleCount = 0;
  $('style').each((_, el) => {
    const content = $(el).html() || '';
    inlineCssBytes += content.length;
    inlineStyleCount++;
  });

  // Check for preloaded CSS
  const hasPreloadCss = $('link[rel="preload"][as="style"]').length > 0;

  return {
    externalCount: externalUrls.length,
    externalUrls,
    inlineStyleCount,
    inlineCssBytes,
    hasPreloadCss,
  };
}

/**
 * Rule: Check CSS file count and size hints
 *
 * Many external CSS files increase HTTP requests and block rendering.
 * Large inline CSS bloats HTML and prevents caching.
 * Recommendations:
 * - Bundle CSS files (<=3 files ideal)
 * - Use critical CSS inline, defer rest
 * - Inline CSS should be <50KB
 */
export const cssFileSizeRule = defineRule({
  id: 'perf-css-file-size',
  name: 'CSS File Size',
  description: 'Checks CSS file count and inline CSS size for performance',
  category: 'performance',
  weight: 10,
  run: (context: AuditContext) => {
    const { $ } = context;
    const analysis = analyzeCss($);

    const issues: string[] = [];
    let severity: 'pass' | 'warn' | 'fail' = 'pass';

    // Check external CSS count
    if (analysis.externalCount > THRESHOLDS.externalFiles.warning) {
      issues.push(`${analysis.externalCount} external CSS files (recommended: <=${THRESHOLDS.externalFiles.good})`);
      severity = 'fail';
    } else if (analysis.externalCount > THRESHOLDS.externalFiles.good) {
      issues.push(`${analysis.externalCount} external CSS files - consider bundling`);
      severity = 'warn';
    }

    // Check inline CSS size
    const inlineCssKb = Math.round(analysis.inlineCssBytes / 1024);
    if (inlineCssKb > THRESHOLDS.inlineCssKb.warning) {
      issues.push(`${inlineCssKb}KB inline CSS (recommended: <${THRESHOLDS.inlineCssKb.good}KB)`);
      if (severity !== 'fail') severity = 'fail';
    } else if (inlineCssKb > THRESHOLDS.inlineCssKb.good) {
      issues.push(`${inlineCssKb}KB inline CSS - consider extracting to external file`);
      if (severity === 'pass') severity = 'warn';
    }

    const details = {
      externalCssCount: analysis.externalCount,
      externalCssUrls: analysis.externalUrls.slice(0, 10),
      inlineStyleCount: analysis.inlineStyleCount,
      inlineCssKb,
      hasPreloadCss: analysis.hasPreloadCss,
      thresholds: THRESHOLDS,
    };

    if (severity === 'fail') {
      return fail('perf-css-file-size', `CSS optimization needed: ${issues.join('; ')}`, details);
    }

    if (severity === 'warn') {
      return warn('perf-css-file-size', `CSS could be optimized: ${issues.join('; ')}`, details);
    }

    const summary = analysis.externalCount === 0
      ? 'No external CSS files (inline only)'
      : `${analysis.externalCount} CSS file(s), ${inlineCssKb}KB inline`;

    return pass('perf-css-file-size', `CSS is well optimized: ${summary}`, details);
  },
});
