import type { AssetInfo, AuditContext, RuleResult } from '../../types.js';
import { defineRule, pass, warn } from '../define-rule.js';

// Reference hint: performance/minify-css

/**
 * Thresholds for inline CSS minification check
 */
const THRESHOLDS = {
  /** Minimum bytes of inline CSS before we check minification */
  minBytesToCheck: 500,
  /** Whitespace ratio above this value suggests unminified CSS */
  whitespaceRatio: 0.15,
};

/**
 * Thresholds for the external-stylesheet heuristic. Asset bodies cannot be
 * read (only response headers are captured), so external minification is
 * inferred from size and the absence of a `.min.` marker in the URL.
 */
const EXTERNAL_THRESHOLDS = {
  /** External stylesheets above this size should be minified */
  minBytesToCheck: 2048,
  /** How many suspect URLs to list in the result message */
  maxListed: 5,
};

/**
 * Calculate the whitespace ratio in a string.
 * Counts newlines, consecutive spaces (>1), and tabs as wasteful whitespace.
 */
function calculateWhitespaceRatio(text: string): number {
  if (text.length === 0) return 0;

  // Count newlines
  const newlineCount = (text.match(/\n/g) || []).length;
  // Count runs of 2+ spaces (the extra spaces beyond the first)
  const extraSpaces = (text.match(/ {2,}/g) || []).reduce((sum, m) => sum + m.length - 1, 0);
  // Count tabs
  const tabCount = (text.match(/\t/g) || []).length;

  const wastedChars = newlineCount + extraSpaces + tabCount;
  return wastedChars / text.length;
}

/**
 * Encoded size from the content-length header, or -1 when absent.
 */
function assetContentLength(asset: AssetInfo): number {
  const raw = asset.headers['content-length'];
  if (!raw) return -1;
  const parsed = parseInt(raw, 10);
  return Number.isNaN(parsed) ? -1 : parsed;
}

/**
 * External stylesheets that look unminified, on headers alone: larger than
 * the threshold and served from a URL without a `.min.` marker. Heuristic
 * only — a file can be minified without the marker, and vice versa.
 */
function findUnminifiedExternalStylesheets(assets: AssetInfo[]): AssetInfo[] {
  return assets.filter(
    (a) =>
      a.resourceType === 'stylesheet' &&
      a.statusCode >= 200 &&
      a.statusCode < 300 &&
      assetContentLength(a) > EXTERNAL_THRESHOLDS.minBytesToCheck &&
      !a.url.split('?')[0].toLowerCase().includes('.min.')
  );
}

/**
 * Check if inline CSS appears to be minified.
 *
 * Unminified inline CSS wastes bytes in the HTML document, increasing
 * page weight and slowing initial render. Minification removes unnecessary
 * whitespace, comments, and formatting without changing behavior.
 */
function checkInlineCss(context: AuditContext): RuleResult {
  const { $ } = context;

  let totalInlineCss = '';
  let styleTagCount = 0;

  $('style').each((_, el) => {
    const content = $(el).html() || '';
    if (content.trim().length > 0) {
      totalInlineCss += content;
      styleTagCount++;
    }
  });

  const totalBytes = Buffer.byteLength(totalInlineCss, 'utf8');

  const details: Record<string, unknown> = {
    styleTagCount,
    totalBytes,
    thresholds: THRESHOLDS,
  };

  // Not enough inline CSS to warrant checking
  if (totalBytes <= THRESHOLDS.minBytesToCheck) {
    return pass(
      'perf-minify-css',
      styleTagCount === 0
        ? 'No inline CSS found'
        : `Inline CSS is minimal (${totalBytes} bytes across ${styleTagCount} <style> tag(s))`,
      details
    );
  }

  const whitespaceRatio = calculateWhitespaceRatio(totalInlineCss);

  details.whitespaceRatio = Math.round(whitespaceRatio * 1000) / 1000;

  if (whitespaceRatio > THRESHOLDS.whitespaceRatio) {
    const estimatedSavings = Math.round(totalBytes * whitespaceRatio);
    return warn(
      'perf-minify-css',
      `Inline CSS appears unminified (${totalBytes} bytes, ~${Math.round(whitespaceRatio * 100)}% whitespace) — minification could save ~${estimatedSavings} bytes`,
      { ...details, estimatedSavingsBytes: estimatedSavings }
    );
  }

  return pass(
    'perf-minify-css',
    `Inline CSS is minified (${totalBytes} bytes, ${Math.round(whitespaceRatio * 100)}% whitespace)`,
    details
  );
}

/**
 * Rule: Check if CSS appears to be minified
 *
 * Inline CSS is checked directly (whitespace ratio). When per-asset render
 * data is available, large external stylesheets served from URLs without a
 * `.min.` marker are flagged as suspects — a heuristic only, since asset
 * bodies are not captured.
 */
export const minifyCssRule = defineRule({
  id: 'perf-minify-css',
  name: 'Minify Inline CSS',
  description:
    'Checks if inline CSS in <style> tags appears to be minified, and heuristically flags large external stylesheets without a .min. URL marker',
  category: 'perf',
  weight: 5,
  run: (context: AuditContext) => {
    const inlineResult = checkInlineCss(context);

    const { assets } = context;
    if (!assets) return inlineResult;

    const suspects = findUnminifiedExternalStylesheets(assets);
    if (suspects.length === 0) return inlineResult;

    const listed = suspects.slice(0, EXTERNAL_THRESHOLDS.maxListed).map((a) => a.url);
    const suffix =
      suspects.length > EXTERNAL_THRESHOLDS.maxListed
        ? `, and ${suspects.length - EXTERNAL_THRESHOLDS.maxListed} more`
        : '';
    const suspectMessage =
      `${suspects.length} external stylesheet(s) appear unminified ` +
      `(heuristic: >${EXTERNAL_THRESHOLDS.minBytesToCheck} bytes and URL lacks ".min." — asset bodies are not inspected): ` +
      `${listed.join(', ')}${suffix}`;
    const details = {
      ...inlineResult.details,
      externalSuspects: suspects.map((a) => a.url),
    };

    if (inlineResult.status !== 'pass') {
      return warn('perf-minify-css', `${inlineResult.message} — additionally, ${suspectMessage}`, details);
    }
    return warn('perf-minify-css', suspectMessage, details);
  },
});
