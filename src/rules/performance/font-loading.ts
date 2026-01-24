import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, fail } from '../define-rule.js';

/**
 * Font loading thresholds
 */
const THRESHOLDS = {
  maxFontFiles: 6, // Warn if more than 6 font files
};

interface FontAnalysis {
  preloadedFonts: string[];
  googleFontsLinks: Array<{ href: string; hasDisplaySwap: boolean }>;
  fontFacesWithDisplay: number;
  fontFacesWithoutDisplay: number;
  totalFontLinks: number;
  hasAnyOptimization: boolean;
}

/**
 * Analyze font loading on the page
 */
function analyzeFontLoading($: AuditContext['$']): FontAnalysis {
  const preloadedFonts: string[] = [];
  const googleFontsLinks: Array<{ href: string; hasDisplaySwap: boolean }> = [];
  let fontFacesWithDisplay = 0;
  let fontFacesWithoutDisplay = 0;

  // Check for preloaded fonts
  $('link[rel="preload"][as="font"]').each((_, el) => {
    const href = $(el).attr('href');
    if (href) {
      preloadedFonts.push(href);
    }
  });

  // Check Google Fonts links for display=swap
  $('link[rel="stylesheet"], link[rel="preconnect"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    if (href.includes('fonts.googleapis.com') || href.includes('fonts.gstatic.com')) {
      const hasDisplaySwap = href.includes('display=swap');
      googleFontsLinks.push({ href, hasDisplaySwap });
    }
  });

  // Check inline @font-face for font-display
  $('style').each((_, el) => {
    const content = $(el).html() || '';
    // Count @font-face declarations
    const fontFaceMatches = content.match(/@font-face\s*\{[^}]*\}/g) || [];
    for (const fontFace of fontFaceMatches) {
      if (/font-display\s*:\s*(swap|optional|fallback|block)/i.test(fontFace)) {
        fontFacesWithDisplay++;
      } else {
        fontFacesWithoutDisplay++;
      }
    }
  });

  // Count total font file references (woff, woff2, ttf, otf, eot)
  let totalFontLinks = 0;
  $('link[rel="preload"][as="font"], link[href*=".woff"], link[href*=".woff2"], link[href*=".ttf"]').each(() => {
    totalFontLinks++;
  });
  // Also count from @font-face src in styles
  $('style').each((_, el) => {
    const content = $(el).html() || '';
    const fontSrcMatches = content.match(/url\s*\([^)]*\.(woff2?|ttf|otf|eot)/gi) || [];
    totalFontLinks += fontSrcMatches.length;
  });

  const hasAnyOptimization =
    preloadedFonts.length > 0 ||
    googleFontsLinks.some((f) => f.hasDisplaySwap) ||
    fontFacesWithDisplay > 0;

  return {
    preloadedFonts,
    googleFontsLinks,
    fontFacesWithDisplay,
    fontFacesWithoutDisplay,
    totalFontLinks,
    hasAnyOptimization,
  };
}

/**
 * Rule: Check font loading best practices
 *
 * Poor font loading causes Flash of Invisible Text (FOIT) or
 * Flash of Unstyled Text (FOUT), impacting LCP and user experience.
 * Best practices:
 * - Use font-display: swap or optional in @font-face
 * - Preload critical fonts
 * - Add &display=swap to Google Fonts URLs
 */
export const fontLoadingRule = defineRule({
  id: 'perf-font-loading',
  name: 'Font Loading',
  description: 'Checks for font loading best practices (font-display, preload)',
  category: 'performance',
  weight: 15,
  run: (context: AuditContext) => {
    const { $ } = context;
    const analysis = analyzeFontLoading($);

    const issues: string[] = [];
    let severity: 'pass' | 'warn' | 'fail' = 'pass';

    // No fonts detected - pass
    if (
      analysis.googleFontsLinks.length === 0 &&
      analysis.fontFacesWithDisplay === 0 &&
      analysis.fontFacesWithoutDisplay === 0 &&
      analysis.preloadedFonts.length === 0 &&
      analysis.totalFontLinks === 0
    ) {
      return pass('perf-font-loading', 'No custom fonts detected', {
        preloadedFonts: [],
        googleFontsLinks: [],
        fontFacesWithDisplay: 0,
        fontFacesWithoutDisplay: 0,
      });
    }

    // Check Google Fonts without display=swap
    const googleFontsWithoutSwap = analysis.googleFontsLinks.filter((f) => !f.hasDisplaySwap);
    if (googleFontsWithoutSwap.length > 0) {
      issues.push(`${googleFontsWithoutSwap.length} Google Fonts URL(s) missing display=swap`);
      severity = 'warn';
    }

    // Check @font-face without font-display
    if (analysis.fontFacesWithoutDisplay > 0) {
      issues.push(`${analysis.fontFacesWithoutDisplay} @font-face rule(s) missing font-display`);
      severity = 'warn';
    }

    // Check for font preloading
    if (analysis.preloadedFonts.length === 0 && analysis.totalFontLinks > 0) {
      issues.push('No fonts are preloaded');
      if (severity === 'pass') severity = 'warn';
    }

    // Check for too many font files
    if (analysis.totalFontLinks > THRESHOLDS.maxFontFiles) {
      issues.push(`${analysis.totalFontLinks} font files loaded (consider reducing)`);
      if (severity === 'pass') severity = 'warn';
    }

    // Critical: no optimization at all
    if (!analysis.hasAnyOptimization && analysis.totalFontLinks > 0) {
      severity = 'fail';
    }

    const details = {
      preloadedFonts: analysis.preloadedFonts,
      googleFontsLinks: analysis.googleFontsLinks.slice(0, 5),
      fontFacesWithDisplay: analysis.fontFacesWithDisplay,
      fontFacesWithoutDisplay: analysis.fontFacesWithoutDisplay,
      totalFontLinks: analysis.totalFontLinks,
    };

    if (severity === 'fail') {
      return fail('perf-font-loading', `Font loading not optimized: ${issues.join('; ')}`, details);
    }

    if (severity === 'warn') {
      return warn('perf-font-loading', `Font loading could be improved: ${issues.join('; ')}`, details);
    }

    const optimizations: string[] = [];
    if (analysis.preloadedFonts.length > 0) optimizations.push(`${analysis.preloadedFonts.length} preloaded`);
    if (analysis.fontFacesWithDisplay > 0) optimizations.push(`font-display set`);
    if (analysis.googleFontsLinks.every((f) => f.hasDisplaySwap)) optimizations.push('display=swap');

    return pass(
      'perf-font-loading',
      `Font loading is optimized (${optimizations.join(', ')})`,
      details
    );
  },
});
