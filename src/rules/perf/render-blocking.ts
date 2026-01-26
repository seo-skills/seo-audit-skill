import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, fail } from '../define-rule.js';

/**
 * Thresholds for render-blocking resources
 */
const THRESHOLDS = {
  blockingScripts: { good: 0, warning: 2 },
  blockingCss: { good: 0 }, // Any non-critical CSS in head is a concern
};

interface RenderBlockingAnalysis {
  blockingScripts: Array<{ src: string; inHead: boolean }>;
  inlineScriptsInHead: number;
  largeInlineScripts: Array<{ size: number }>;
  potentiallyBlockingCss: string[];
  asyncScripts: number;
  deferScripts: number;
  moduleScripts: number;
}

/**
 * Analyze render-blocking resources
 */
function analyzeRenderBlocking($: AuditContext['$']): RenderBlockingAnalysis {
  const blockingScripts: Array<{ src: string; inHead: boolean }> = [];
  let inlineScriptsInHead = 0;
  const largeInlineScripts: Array<{ size: number }> = [];
  const potentiallyBlockingCss: string[] = [];
  let asyncScripts = 0;
  let deferScripts = 0;
  let moduleScripts = 0;

  // Analyze scripts in <head>
  $('head script').each((_, el) => {
    const src = $(el).attr('src');
    const isAsync = $(el).attr('async') !== undefined;
    const isDefer = $(el).attr('defer') !== undefined;
    const isModule = $(el).attr('type') === 'module';

    if (isAsync) asyncScripts++;
    if (isDefer) deferScripts++;
    if (isModule) moduleScripts++;

    // External script without async/defer/module
    if (src && !isAsync && !isDefer && !isModule) {
      blockingScripts.push({ src, inHead: true });
    }

    // Large inline scripts (blocking)
    if (!src) {
      const content = $(el).html() || '';
      const sizeKb = Math.round(content.length / 1024);
      inlineScriptsInHead++;
      if (sizeKb > 10) {
        largeInlineScripts.push({ size: sizeKb });
      }
    }
  });

  // Analyze scripts in <body> (less critical but can still block)
  $('body script[src]').each((_, el) => {
    const src = $(el).attr('src');
    const isAsync = $(el).attr('async') !== undefined;
    const isDefer = $(el).attr('defer') !== undefined;
    const isModule = $(el).attr('type') === 'module';

    if (isAsync) asyncScripts++;
    if (isDefer) deferScripts++;
    if (isModule) moduleScripts++;

    // Sync script early in body can still block
    if (src && !isAsync && !isDefer && !isModule) {
      blockingScripts.push({ src, inHead: false });
    }
  });

  // Analyze CSS - any CSS without media query potentially blocks
  $('head link[rel="stylesheet"]').each((_, el) => {
    const href = $(el).attr('href');
    const media = $(el).attr('media');

    // CSS with media="print" or media="(specific condition)" is non-blocking
    if (href && (!media || media === 'all' || media === 'screen')) {
      potentiallyBlockingCss.push(href);
    }
  });

  return {
    blockingScripts,
    inlineScriptsInHead,
    largeInlineScripts,
    potentiallyBlockingCss,
    asyncScripts,
    deferScripts,
    moduleScripts,
  };
}

/**
 * Rule: Check for render-blocking resources
 *
 * Render-blocking resources delay First Contentful Paint (FCP)
 * and Largest Contentful Paint (LCP). Solutions:
 * - Add async or defer to scripts
 * - Use type="module" for ES modules
 * - Inline critical CSS, defer non-critical
 */
export const renderBlockingRule = defineRule({
  id: 'perf-render-blocking',
  name: 'Render-Blocking Resources',
  description: 'Checks for render-blocking CSS and JavaScript in the head',
  category: 'perf',
  weight: 20,
  run: (context: AuditContext) => {
    const { $ } = context;
    const analysis = analyzeRenderBlocking($);

    const issues: string[] = [];
    let severity: 'pass' | 'warn' | 'fail' = 'pass';

    // Check blocking scripts
    const blockingInHead = analysis.blockingScripts.filter((s) => s.inHead);
    if (blockingInHead.length > THRESHOLDS.blockingScripts.warning) {
      issues.push(`${blockingInHead.length} render-blocking scripts in <head>`);
      severity = 'fail';
    } else if (blockingInHead.length > THRESHOLDS.blockingScripts.good) {
      issues.push(`${blockingInHead.length} script(s) in <head> without async/defer`);
      severity = 'warn';
    }

    // Check large inline scripts
    if (analysis.largeInlineScripts.length > 0) {
      const totalKb = analysis.largeInlineScripts.reduce((sum, s) => sum + s.size, 0);
      issues.push(`${analysis.largeInlineScripts.length} large inline script(s) (${totalKb}KB total)`);
      if (severity === 'pass') severity = 'warn';
    }

    // Note about potentially blocking CSS (informational)
    // CSS is inherently render-blocking, so we just report it
    const cssNote =
      analysis.potentiallyBlockingCss.length > 3
        ? `${analysis.potentiallyBlockingCss.length} CSS files in head (consider critical CSS extraction)`
        : null;

    if (cssNote && severity === 'pass' && analysis.potentiallyBlockingCss.length > 5) {
      issues.push(cssNote);
      severity = 'warn';
    }

    const details = {
      blockingScripts: analysis.blockingScripts.slice(0, 10),
      inlineScriptsInHead: analysis.inlineScriptsInHead,
      largeInlineScripts: analysis.largeInlineScripts,
      potentiallyBlockingCss: analysis.potentiallyBlockingCss.slice(0, 5),
      asyncScripts: analysis.asyncScripts,
      deferScripts: analysis.deferScripts,
      moduleScripts: analysis.moduleScripts,
    };

    if (severity === 'fail') {
      return fail('perf-render-blocking', `Render-blocking resources detected: ${issues.join('; ')}`, details);
    }

    if (severity === 'warn') {
      return warn('perf-render-blocking', `Render-blocking resources found: ${issues.join('; ')}`, details);
    }

    const optimizedCount = analysis.asyncScripts + analysis.deferScripts + analysis.moduleScripts;
    const message =
      optimizedCount > 0
        ? `No render-blocking scripts (${optimizedCount} async/defer/module)`
        : analysis.blockingScripts.length === 0
          ? 'No external scripts in head'
          : 'Scripts properly optimized';

    return pass('perf-render-blocking', message, details);
  },
});
