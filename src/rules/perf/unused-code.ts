import type { AuditContext, RuleResult } from '../../types.js';
import { defineRule, pass, warn, fail, notMeasured } from '../define-rule.js';

/** One resource wasting this much warns (the Lighthouse convention) */
const WARN_RESOURCE_BYTES = 20 * 1024;
/** This much waste across the page fails */
const FAIL_TOTAL_BYTES = 250 * 1024;
const LISTED = 10;

const kib = (bytes: number) => `${Math.round(bytes / 1024)} KiB`;

/** The page's own site: its host, or a subdomain of its host without www */
function isFirstParty(resource: string, page: string): boolean {
  try {
    const host = new URL(resource).hostname;
    const base = new URL(page).hostname.replace(/^www\./, '');
    return host === base || host.endsWith(`.${base}`);
  } catch {
    return false;
  }
}

function judge(id: string, kind: 'js' | 'css', context: AuditContext): RuleResult {
  const label = kind === 'js' ? 'JavaScript' : 'CSS';
  if (!context.coverage) {
    return notMeasured(id, 'This renderer does not collect code coverage (the desktop app cannot yet)', undefined, 'unsupported');
  }
  const resources = context.coverage[kind];
  if (resources.length === 0) {
    return notMeasured(id, `No ${label} files loaded`, undefined, 'not-applicable');
  }

  const ranked = [...resources].sort((a, b) => b.unusedBytes - a.unusedBytes);
  const total = ranked.reduce((sum, r) => sum + r.unusedBytes, 0);
  const wasteful = ranked.filter((r) => r.unusedBytes >= WARN_RESOURCE_BYTES);
  const details = {
    files: resources.length,
    unusedBytes: total,
    top: ranked.slice(0, LISTED).map((r) => ({
      url: r.url,
      party: isFirstParty(r.url, context.url) ? 'first-party' : 'third-party',
      totalBytes: r.totalBytes,
      unusedBytes: r.unusedBytes,
      unusedPercent: r.totalBytes ? Math.round((r.unusedBytes / r.totalBytes) * 100) : 0,
    })),
  };
  const fix =
    kind === 'js'
      ? 'Split bundles by route and load code when it is needed; drop libraries the page does not use.'
      : 'Remove unused selectors, split CSS by page, and inline only what the first screen needs.';

  if (total >= FAIL_TOTAL_BYTES) {
    return fail(id, `${kib(total)} of ${label} loaded but never run during page load`, { ...details, recommendation: fix });
  }
  if (wasteful.length > 0) {
    return warn(id, `${wasteful.length} ${label} file(s) are mostly unused during load (${kib(total)} in total)`, { ...details, recommendation: fix });
  }
  return pass(id, `${label} loaded is mostly used (${kib(total)} unused)`, details);
}

/**
 * Rule: JavaScript the page loads but does not run
 *
 * Every byte of script is downloaded, parsed and compiled whether it runs or
 * not. Measured with the browser's code coverage during load: code for later
 * interactions counts as unused, so this is an upper bound.
 */
export const unusedJsRule = defineRule({
  id: 'perf-unused-js',
  name: 'Unused JavaScript',
  description: 'Measures the JavaScript each file loads but does not run during page load',
  category: 'perf',
  weight: 5,
  advisory: true,
  requiresRender: true,
  run: (context: AuditContext) => judge('perf-unused-js', 'js', context),
});

/**
 * Rule: CSS the page loads but does not use
 *
 * Stylesheets block rendering until they are downloaded and parsed, unused
 * rules included.
 */
export const unusedCssRule = defineRule({
  id: 'perf-unused-css',
  name: 'Unused CSS',
  description: 'Measures the CSS each stylesheet loads that no element on the page uses',
  category: 'perf',
  weight: 5,
  advisory: true,
  requiresRender: true,
  run: (context: AuditContext) => judge('perf-unused-css', 'css', context),
});
