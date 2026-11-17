import type {
  PageSnapshot,
  AuditResult,
  CategoryResult,
  RuleResult,
  RuleStatus,
} from '../types.js';
import type { RuleSummary } from '../dashboard/contract.js';
import { scoreToVerdict, verdictStyle } from '../verdict.js';
import { rulePriority } from '../rules/priority.js';
import type { OverridePriority } from '../types.js';
import { toCss as tokensToCss } from '../design/tokens.js';
import { getCategoryById } from '../categories/index.js';
import { getFixSuggestion } from './fix-suggestions.js';
import { getRuleById } from '../rules/registry.js';
import { isNotMeasured } from '../rules/define-rule.js';

/**
 * Rule metadata cache structure
 */
interface RuleMetadata {
  id: string;
  name: string;
  description: string;
}

/**
 * How a result is presented, which is not the same as the status it carries.
 *
 * A check that took no reading is stored as `warn` with weight 0 (see
 * `notMeasured()`), because there is no fourth `RuleResult` status. Painting it
 * amber alongside real warnings is what produced a report advertising 52
 * warnings when 28 were real, and offering "how to fix" advice for a metric
 * nobody measured. The reporter splits it back out for display only.
 */
type DisplayStatus = 'fail' | 'warn' | 'pass' | 'notmeasured';

/** One glyph per display status, so icon and status can never drift apart. */
const STATUS_ICONS: Record<DisplayStatus, string> = {
  pass: '✓',
  warn: '!',
  fail: '✕',
  notmeasured: '–',
};

/**
 * Resolve the display status for a result. Weight 0 is the marker, exactly as
 * `scoring.ts` and the terminal reporter read it.
 */
function toDisplayStatus(result: RuleResult): DisplayStatus {
  // `isNotMeasured` covers the new status and both legacy encodings, so the
  // remaining values really are the three measured ones.
  return isNotMeasured(result) ? 'notmeasured' : (result.status as Exclude<DisplayStatus, 'notmeasured'>);
}

/**
 * Which pages a finding covers, as indices into the report's page list.
 *
 * This was the full URL list, repeated verbatim on the table row and again on
 * the rule card: `data-urls="https://…/page-0,https://…/page-1,…"`. On a
 * 1,000-page crawl that came to 20.6MB across 350 attributes — for data the
 * page already carries once, used only to drive a dropdown filter.
 *
 * Indices instead, and `*` when a finding covers every page, which is the case
 * that produced the blowup. The URLs themselves are emitted once, in the script
 * the filter already needs.
 */
function encodePages(pages: string[], indexOf: Map<string, number>, total: number): string {
  if (pages.length === 0) return '';
  if (pages.length >= total) return '*';
  const seen = new Set<number>();
  for (const url of pages) {
    const i = indexOf.get(url);
    if (i !== undefined) seen.add(i);
  }
  if (seen.size >= total) return '*';
  return [...seen].sort((a, b) => a - b).join(',');
}

/**
 * How many affected pages a rule lists before it just counts the rest.
 *
 * A rule that fails on every page of a 1,000-page crawl produced 1,000 anchors
 * inside one card. Multiplied across 340 rules that was 48MB of a 69MB file —
 * all of it inside a closed `<details>`, so it was never even read.
 */
const MAX_LISTED_PAGES = 10;

/** The inverse of `toDisplayStatus`, for the ranker's benefit. */
function fromDisplayStatus(status: DisplayStatus): RuleStatus {
  return status === 'notmeasured' ? 'not-measured' : status;
}

/**
 * Aggregated issue structure for grouping same-rule occurrences
 */
interface AggregatedIssue {
  ruleId: string;
  status: DisplayStatus;
  categoryId: string;
  categoryName: string;
  message: string;
  ruleName: string;
  ruleDescription: string;
  pages: Array<{ url: string; details: Record<string, unknown> }>;
  pageCount: number;
  /**
   * How much attention this finding deserves relative to the others in this
   * audit. Ordering by severity alone put a weight-1 warning above a weight-25
   * one, which is most of why a reader had to scroll a 54,000-pixel report to
   * find out what to fix first.
   */
  priority: number;
  /** `[rules.override]` priority, when the config set one */
  override?: OverridePriority;
}

/**
 * Build a cache of rule metadata for efficient lookup
 */
function buildRuleMetadataCache(categoryResults: CategoryResult[]): Map<string, RuleMetadata> {
  const cache = new Map<string, RuleMetadata>();

  for (const cat of categoryResults) {
    for (const r of cat.results) {
      if (!cache.has(r.ruleId)) {
        const rule = getRuleById(r.ruleId);
        cache.set(r.ruleId, {
          id: r.ruleId,
          name: rule?.name ?? formatRuleIdAsName(r.ruleId),
          description: rule?.description ?? ''
        });
      }
    }
  }

  return cache;
}

/**
 * Format a rule ID as a human-readable name (fallback)
 * e.g., "core-title-present" -> "Core Title Present"
 */
function formatRuleIdAsName(ruleId: string): string {
  return ruleId
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Aggregate issues by rule, grouping same-rule occurrences across pages
 */
function aggregateIssuesByRule(
  categoryResults: CategoryResult[],
  ruleMetadataCache: Map<string, RuleMetadata>
): Map<string, AggregatedIssue[]> {
  const aggregatedByCategory = new Map<string, AggregatedIssue[]>();

  for (const cat of categoryResults) {
    const category = getCategoryById(cat.categoryId);
    const categoryName = category?.name ?? cat.categoryId;

    // Group by ruleId + status within this category
    const ruleGroups = new Map<string, AggregatedIssue>();

    for (const r of cat.results) {
      // Group on the display status, so a rule that warned on one page and
      // went unmeasured on another lands in two groups rather than one
      // mislabelled group.
      const displayStatus = toDisplayStatus(r);
      const key = `${r.ruleId}:${displayStatus}`;
      const url = extractUrlFromDetails(r.details);
      const metadata = ruleMetadataCache.get(r.ruleId);

      if (!ruleGroups.has(key)) {
        ruleGroups.set(key, {
          ruleId: r.ruleId,
          status: displayStatus,
          categoryId: cat.categoryId,
          categoryName,
          message: r.message,
          ruleName: metadata?.name ?? formatRuleIdAsName(r.ruleId),
          ruleDescription: metadata?.description ?? '',
          pages: [],
          pageCount: 0,
          priority: 0,
          ...(r.overridden?.priority && { override: r.overridden.priority }),
        });
      }

      const group = ruleGroups.get(key)!;
      if (url) {
        group.pages.push({ url, details: r.details || {} });
      }
      group.pageCount++;

      // A stored audit arrives as `RuleSummary`, already ranked server-side
      // against the full page counts. Prefer that over anything derived here.
      const stored = (r as Partial<RuleSummary>).priority;
      if (typeof stored === 'number') group.priority = stored;
    }

    const groups = Array.from(ruleGroups.values());

    // A live audit has one result per rule per page and no precomputed rank, so
    // derive the same number: the share of measured pages this status covers.
    const measuredByRule = new Map<string, number>();
    for (const g of groups) {
      if (g.status === 'notmeasured') continue;
      measuredByRule.set(g.ruleId, (measuredByRule.get(g.ruleId) ?? 0) + g.pageCount);
    }
    for (const g of groups) {
      if (g.priority) continue;
      const measuredPages = measuredByRule.get(g.ruleId) ?? 0;
      g.priority = rulePriority({
        ruleId: g.ruleId,
        categoryId: cat.categoryId,
        status: fromDisplayStatus(g.status),
        affectedPages: g.pageCount,
        measuredPages,
        ...(g.override && { override: g.override }),
      });
    }

    aggregatedByCategory.set(cat.categoryId, groups);
  }

  return aggregatedByCategory;
}

/**
 * Colour for a score, from the one shared bucket set.
 *
 * This used to carry its own 90/70/50 thresholds, so a score of 85 drew green
 * in the terminal and the dashboard (verdict bucket B) and amber here. The
 * scale lives in `src/verdict.ts` and nowhere else.
 */
function getScoreColor(score: number): string {
  return verdictStyle(score).color;
}

/**
 * Paired background for a score badge. Never build this by appending an alpha
 * suffix to `getScoreColor()` — that yields `var(--color-pass)20`, which is
 * dropped silently and leaves the badge with no background at all.
 */
function getScoreBackground(score: number): string {
  return verdictStyle(score).backgroundColor;
}

/**
 * Get score label
 */

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string | null | undefined): string {
  if (text == null) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Extract URL from rule result details
 */
function extractUrlFromDetails(details: Record<string, unknown> | undefined): string | null {
  if (!details) return null;

  // pageUrl is the standard field injected by the auditor
  // Check it first, then fall back to other common URL fields
  const urlFields = ['pageUrl', 'url', 'htmlCanonical', 'canonical'];
  for (const field of urlFields) {
    const value = details[field];
    if (typeof value === 'string' && value.startsWith('http')) {
      return value;
    }
  }
  return null;
}

/**
 * Get short URL path for display.
 *
 * The site root renders as "Homepage" rather than "/". A lone slash is the
 * shortest possible label and the least readable one: readers scanning a
 * report could not tell that it meant the page they had just audited.
 */
function getShortUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.pathname === '/' ? 'Homepage' : parsed.pathname;
  } catch {
    return url;
  }
}

/**
 * Generate the HTML CSS styles - complete redesign
 */
function generateStyles(): string {
  return `
    /* ========================================
       Design tokens — generated, not written here
       ========================================
       These used to be declared inline, and the copy in the dashboard had
       already drifted: this file painted pure black (#000000) for the dark
       background where the app painted zinc (#09090b), and the two disagreed
       on every raised surface. One source now: src/design/tokens.ts. */
${tokensToCss()}

    /* ========================================
       Base Styles
       ======================================== */
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    html {
      scroll-behavior: smooth;
      scroll-padding-top: calc(var(--header-height) + 20px);
    }

    body {
      font-family: var(--font-sans);
      background: var(--color-bg);
      color: var(--color-text);
      line-height: 1.6;
      font-size: 14px;
      min-height: 100vh;
    }

    /* ========================================
       Fixed Header
       ======================================== */
    .header {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      height: var(--header-height);
      background: var(--color-bg-elevated);
      border-bottom: 1px solid var(--color-border);
      z-index: 100;
      display: flex;
      align-items: center;
      padding: 0 24px;
      gap: 24px;
      box-shadow: var(--shadow-sm);
    }

    .header-brand {
      display: flex;
      align-items: center;
      gap: 10px;
      font-weight: 600;
      font-size: 16px;
      color: var(--color-text);
      text-decoration: none;
      flex-shrink: 0;
    }

    /* The wordmark is ~5:1, so it is sized by height and lets width follow.
       Its lettering inherits colour from here and flips with the theme. */
    .header-logo {
      display: block;
      color: var(--color-text);
    }

    .header-logo svg {
      display: block;
      height: 22px;
      width: auto;
    }

    .header-brand-divider {
      width: 1px;
      height: 20px;
      background: var(--color-border);
      flex-shrink: 0;
    }

    .header-brand-product {
      white-space: nowrap;
    }

    .header-brand-tag {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--color-accent);
      background: var(--color-accent-light);
      padding: 3px 8px;
      border-radius: var(--radius-full);
      white-space: nowrap;
    }

    /* Icons elsewhere in the header keep the original square sizing. */
    .header-meta-item svg {
      width: 14px;
      height: 14px;
    }

    .header-url {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 12px;
      background: var(--color-bg);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      font-family: var(--font-mono);
      font-size: 12px;
      color: var(--color-text-secondary);
      max-width: 400px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .header-url a {
      color: inherit;
      text-decoration: none;
    }

    .header-url a:hover {
      color: var(--color-accent);
    }

    .header-meta {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-left: auto;
      font-size: 12px;
      color: var(--color-text-muted);
    }

    .header-meta-item {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .theme-toggle {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      background: var(--color-bg);
      cursor: pointer;
      color: var(--color-text-secondary);
      transition: all 0.2s;
    }

    .theme-toggle:hover {
      background: var(--color-bg-hover);
      color: var(--color-text);
    }

    .theme-toggle svg {
      width: 18px;
      height: 18px;
    }

    .theme-toggle .icon-moon { display: block; }
    .theme-toggle .icon-sun { display: none; }
    [data-theme="dark"] .theme-toggle .icon-moon { display: none; }
    [data-theme="dark"] .theme-toggle .icon-sun { display: block; }

    /* ========================================
       Sidebar Navigation
       ======================================== */
    .sidebar {
      position: fixed;
      top: var(--header-height);
      left: 0;
      bottom: 0;
      width: var(--sidebar-width);
      background: var(--color-bg-elevated);
      border-right: 1px solid var(--color-border);
      overflow-y: auto;
      padding: 16px 0;
      z-index: 50;
    }

    .sidebar-section {
      padding: 0 12px;
      margin-bottom: 24px;
    }

    .sidebar-title {
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--color-text-muted);
      padding: 8px 12px;
      margin-bottom: 4px;
    }

    .sidebar-nav {
      list-style: none;
    }

    .sidebar-link {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 12px;
      border-radius: var(--radius-md);
      color: var(--color-text-secondary);
      text-decoration: none;
      font-size: 13px;
      font-weight: 500;
      transition: all 0.15s;
      cursor: pointer;
    }

    .sidebar-link:hover {
      background: var(--color-bg-hover);
      color: var(--color-text);
    }

    .sidebar-link.active {
      background: var(--color-accent);
      color: white;
    }

    .sidebar-link-icon {
      width: 18px;
      height: 18px;
      flex-shrink: 0;
      opacity: 0.7;
    }

    .sidebar-link-count {
      margin-left: auto;
      font-size: 11px;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: var(--radius-full);
      background: var(--color-bg);
    }

    .sidebar-link-count.fail {
      background: var(--color-fail-bg);
      color: var(--color-fail);
    }

    .sidebar-link-count.warn {
      background: var(--color-warn-bg);
      color: var(--color-warn);
    }

    .sidebar-link-count.pass {
      background: var(--color-pass-bg);
      color: var(--color-pass);
    }

    /* Checks that need no action, folded out of the way */
    .quiet-rules {
      margin-top: 8px;
      border-top: 1px solid var(--color-border);
    }

    .quiet-rules summary {
      cursor: pointer;
      padding: 7px 4px;
      font-size: 13px;
      font-weight: 500;
      color: var(--color-text-muted);
      list-style: none;
    }

    .quiet-rules summary::marker,
    .quiet-rules summary::-webkit-details-marker { display: none; }

    .quiet-rules summary::before {
      content: '▶';
      font-size: 9px;
      margin-right: 8px;
      display: inline-block;
    }

    .quiet-rules[open] summary::before { content: '▼'; }

    .quiet-rules summary:hover { color: var(--color-text); }

    .quiet-rules summary:focus-visible {
      outline: 2px solid var(--color-accent);
      outline-offset: 2px;
      border-radius: var(--radius-sm);
    }

    /* Pages covered, when the results are aggregated and cannot be filtered */
    .pages-covered summary {
      font-size: 12px;
      font-weight: 600;
      color: var(--color-text);
      cursor: pointer;
      padding: 8px 12px;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      background: var(--color-bg);
      list-style: none;
    }

    .pages-covered summary::marker,
    .pages-covered summary::-webkit-details-marker { display: none; }

    .pages-covered summary::before {
      content: '▶';
      font-size: 9px;
      color: var(--color-text-muted);
      margin-right: 8px;
      display: inline-block;
    }

    .pages-covered[open] summary::before { content: '▼'; }

    .pages-covered ul {
      list-style: none;
      margin: 6px 0 0;
      padding: 0 0 0 12px;
    }

    .pages-covered li { margin: 0; }

    .pages-covered a {
      display: block;
      padding: 5px 0;
      font-size: 12px;
      color: var(--color-text-muted);
      text-decoration: none;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .pages-covered a:hover { color: var(--color-accent); }

    /* URL Filter in sidebar */
    .url-filter {
      padding: 0 12px;
      margin-bottom: 16px;
    }

    .url-filter-label {
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--color-text-muted);
      padding: 8px 12px;
      margin-bottom: 8px;
      display: block;
    }

    .url-filter-select {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      background: var(--color-bg);
      color: var(--color-text);
      font-size: 12px;
      font-family: var(--font-mono);
      cursor: pointer;
      appearance: none;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%2364748b' viewBox='0 0 16 16'%3E%3Cpath d='M8 11L3 6h10l-5 5z'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 12px center;
    }

    .url-filter-select:focus {
      outline: none;
      border-color: var(--color-accent);
      box-shadow: 0 0 0 3px var(--color-accent-light);
    }

    /* ========================================
       Main Content Area
       ======================================== */
    .main {
      margin-left: var(--sidebar-width);
      margin-top: var(--header-height);
      min-height: calc(100vh - var(--header-height));
      padding: 24px;
    }

    .content {
      max-width: var(--content-max-width);
      margin: 0 auto;
    }

    /* ========================================
       Score Overview Card
       ======================================== */
    .score-overview {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 24px 32px;
      background: var(--color-bg-elevated);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      padding: 24px;
      margin-bottom: 24px;
      box-shadow: var(--shadow-sm);
    }

    .score-overview > .score-details {
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 16px;
    }

    .score-overview > .score-details > .category-progress-section {
      grid-column: 1 / -1;
    }

    .score-circle {
      position: relative;
      width: 140px;
      height: 140px;
    }

    .score-circle svg {
      transform: rotate(-90deg);
    }

    .score-circle-bg {
      fill: none;
      stroke: var(--color-border);
      stroke-width: 8;
    }

    .score-circle-progress {
      fill: none;
      stroke-width: 8;
      stroke-linecap: round;
      transition: stroke-dashoffset 0.5s ease;
    }

    .score-circle-text {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }

    .score-value {
      font-size: 36px;
      font-weight: 700;
      line-height: 1;
      font-family: var(--font-mono);
    }

    .score-label {
      font-size: 12px;
      color: var(--color-text-muted);
      margin-top: 4px;
    }

    .score-status {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      border-radius: var(--radius-full);
      font-size: 13px;
      font-weight: 600;
      width: fit-content;
    }

    .score-status.pass {
      background: var(--color-pass-bg);
      color: var(--color-pass);
    }

    .score-status.fail {
      background: var(--color-fail-bg);
      color: var(--color-fail);
    }

    .score-stats {
      display: flex;
      gap: 24px;
    }

    .score-stat {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .score-stat-value {
      font-size: 24px;
      font-weight: 700;
      font-family: var(--font-mono);
    }

    .score-stat-value.fail { color: var(--color-fail); }
    .score-stat-value.warn { color: var(--color-warn); }
    .score-stat-value.not-measured { color: var(--color-neutral); }
    .score-stat-value.pass { color: var(--color-pass); }

    .score-stat-label {
      font-size: 12px;
      color: var(--color-text-muted);
    }

    .score-cap {
      font-size: 13px;
      color: var(--color-text-secondary);
    }

    .score-cap ul {
      margin: 4px 0 0;
      padding-left: 18px;
    }

    /* ========================================
       Category Progress Bars
       ======================================== */
    .category-progress-section {
      margin-top: 20px;
      padding-top: 20px;
      border-top: 1px solid var(--color-border);
    }

    .category-progress-title {
      font-size: 12px;
      font-weight: 600;
      color: var(--color-text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 12px;
    }

    .category-progress-list {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 10px;
    }

    .category-progress-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px 12px;
      background: var(--color-bg);
      border-radius: var(--radius-md);
      cursor: pointer;
      transition: background 0.15s;
      text-decoration: none;
      color: inherit;
    }

    .category-progress-item:hover {
      background: var(--color-bg-hover);
    }

    .category-progress-name {
      font-size: 12px;
      font-weight: 500;
      min-width: 100px;
      flex-shrink: 0;
    }

    .category-progress-bar {
      flex: 1;
      height: 6px;
      background: var(--color-border);
      border-radius: var(--radius-full);
      overflow: hidden;
    }

    .category-progress-fill {
      height: 100%;
      border-radius: var(--radius-full);
      transition: width 0.5s ease;
    }

    .category-progress-value {
      font-family: var(--font-mono);
      font-size: 11px;
      font-weight: 600;
      min-width: 36px;
      text-align: right;
    }

    /* ========================================
       PAGE SNAPSHOT: metrics, previews, outline
       ======================================== */
    .snapshot-metrics {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
      gap: 1px;
      background: var(--color-border);
      border: 1px solid var(--color-border);
      border-radius: 8px;
      overflow: hidden;
      margin-bottom: 16px;
    }
    .snapshot-metric {
      background: var(--color-bg-elevated);
      padding: 14px 16px;
      text-align: center;
    }
    .snapshot-metric-value {
      display: block;
      font-family: var(--font-mono);
      font-size: 20px;
      font-weight: 600;
      color: var(--color-text);
    }
    .snapshot-metric-label {
      display: block;
      margin-top: 2px;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--color-text-muted);
    }
    .snapshot-panels {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }
    .snapshot-panel {
      background: var(--color-bg-elevated);
      border: 1px solid var(--color-border);
      border-radius: 8px;
      padding: 16px 18px;
      min-width: 0;
    }
    .snapshot-panel-title {
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--color-text-muted);
      margin: 0 0 12px;
    }
    .snapshot-subtitle {
      font-size: 11px;
      font-weight: 600;
      color: var(--color-text-muted);
      margin: 16px 0 6px;
    }
    .snapshot-subtitle:first-of-type { margin-top: 0; }
    .snapshot-missing {
      color: var(--color-warn);
      font-style: italic;
    }

    /* Search result preview */
    .serp-preview { font-family: arial, sans-serif; max-width: 600px; }
    .serp-url { font-size: 12px; color: var(--color-text-secondary); word-break: break-all; }
    .serp-title {
      font-size: 18px;
      line-height: 1.3;
      color: #1a0dab;
      margin: 2px 0 3px;
      overflow-wrap: anywhere;
    }
    [data-theme="dark"] .serp-title { color: #8ab4f8; }
    .serp-description {
      font-size: 13px;
      line-height: 1.5;
      color: var(--color-text-secondary);
      overflow-wrap: anywhere;
    }

    /* Social share card preview */
    .social-card {
      border: 1px solid var(--color-border);
      border-radius: 8px;
      overflow: hidden;
      max-width: 480px;
    }
    .social-card-image {
      display: block;
      width: 100%;
      max-height: 240px;
      object-fit: cover;
      background: var(--color-bg-hover);
    }
    .social-card-body { padding: 10px 12px; }
    .social-card-site {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      color: var(--color-text-muted);
    }
    .social-card-title {
      font-size: 14px;
      font-weight: 600;
      color: var(--color-text);
      margin: 2px 0;
      overflow-wrap: anywhere;
    }
    .social-card-description {
      font-size: 12px;
      color: var(--color-text-secondary);
      overflow-wrap: anywhere;
    }

    /* Heading outline */
    .heading-outline {
      list-style: none;
      margin: 0;
      padding: 0;
      max-height: 340px;
      overflow-y: auto;
    }
    .heading-outline li {
      display: flex;
      gap: 8px;
      align-items: baseline;
      padding: 3px 0;
      font-size: 13px;
      border-bottom: 1px solid var(--color-border-subtle);
    }
    .heading-outline li:last-child { border-bottom: none; }
    .heading-level {
      flex: none;
      font-family: var(--font-mono);
      font-size: 10px;
      font-weight: 600;
      padding: 1px 5px;
      border-radius: 3px;
      background: var(--color-bg-active);
      color: var(--color-text-secondary);
    }
    .heading-level.h1 { background: var(--color-info-bg); color: var(--color-info); }
    .heading-text { color: var(--color-text); overflow-wrap: anywhere; }

    /* ========================================
       Filter Tabs (Fixed below header)
       ======================================== */
    .filter-bar {
      position: sticky;
      top: var(--header-height);
      background: var(--color-bg);
      padding: 16px 0;
      margin-bottom: 16px;
      z-index: 40;
      border-bottom: 1px solid var(--color-border);
    }

    .filter-tabs {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .filter-tab {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 16px;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-full);
      background: var(--color-bg-elevated);
      font-size: 13px;
      font-weight: 500;
      color: var(--color-text-secondary);
      cursor: pointer;
      transition: all 0.15s;
    }

    .filter-tab:hover {
      border-color: var(--color-accent);
      color: var(--color-accent);
    }

    .filter-tab.active {
      background: var(--color-accent);
      border-color: var(--color-accent);
      color: white;
    }

    .filter-tab-count {
      font-size: 11px;
      font-weight: 600;
      padding: 2px 6px;
      border-radius: var(--radius-full);
      background: rgba(0, 0, 0, 0.1);
    }

    .filter-tab.active .filter-tab-count {
      background: rgba(255, 255, 255, 0.2);
    }

    /* ========================================
       Issues Summary Table (Ahrefs-style)
       ======================================== */
    .issues-summary {
      background: var(--color-bg-elevated);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      overflow: hidden;
      margin-bottom: 24px;
      box-shadow: var(--shadow-sm);
    }

    .issues-summary-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 20px;
      border-bottom: 1px solid var(--color-border);
      background: var(--color-bg);
    }

    .issues-summary-title {
      font-size: 14px;
      font-weight: 600;
    }

    .issues-table {
      width: 100%;
      border-collapse: collapse;
    }

    .issues-table th {
      text-align: left;
      padding: 8px 16px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--color-text-muted);
      background: var(--color-bg);
      border-bottom: 1px solid var(--color-border);
    }

    .issues-table th:first-child {
      padding-left: 20px;
    }

    .issues-table td {
      /* Ten of these decide whether the top ten findings reach the first
         screen: at 14px the tenth row landed at y=980 on a 900px viewport. */
      padding: 8px 16px;
      border-bottom: 1px solid var(--color-border-subtle);
      font-size: 13px;
    }

    .issues-table td:first-child {
      padding-left: 20px;
    }

    .issues-table tr:last-child td {
      border-bottom: none;
    }

    .issues-table tbody tr {
      cursor: pointer;
      transition: background 0.15s;
    }

    .issues-table tbody tr:hover {
      background: var(--color-bg-hover);
    }

    .issues-table tbody tr.hidden {
      display: none;
    }

    .issue-row-name {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .issue-row-icon {
      width: 20px;
      height: 20px;
      border-radius: var(--radius-sm);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      font-size: 12px;
    }

    .issue-row-icon.fail {
      background: var(--color-fail-bg);
      color: var(--color-fail);
    }

    .issue-row-icon.warn {
      background: var(--color-warn-bg);
      color: var(--color-warn);
    }

    .issue-row-icon.pass {
      background: var(--color-pass-bg);
      color: var(--color-pass);
    }

    .issue-row-text {
      font-weight: 500;
    }

    .issue-row-category {
      font-size: 11px;
      color: var(--color-text-muted);
      margin-top: 2px;
    }

    .issue-row-url {
      font-family: var(--font-mono);
      font-size: 11px;
      color: var(--color-accent);
      max-width: 200px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .issue-row-severity {
      font-family: var(--font-mono);
      font-size: 12px;
      font-weight: 600;
      padding: 4px 10px;
      border-radius: var(--radius-full);
    }

    .issue-row-severity.fail {
      background: var(--color-fail-bg);
      color: var(--color-fail);
    }

    .issue-row-severity.warn {
      background: var(--color-warn-bg);
      color: var(--color-warn);
    }

    /* ========================================
       Category Sections
       ======================================== */
    .category-section {
      margin-bottom: 32px;
      scroll-margin-top: calc(var(--header-height) + 80px);
    }

    .category-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 20px;
      background: var(--color-bg-elevated);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg) var(--radius-lg) 0 0;
    }

    .category-title {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .category-name {
      font-size: 16px;
      font-weight: 600;
    }

    .category-score {
      font-family: var(--font-mono);
      font-size: 14px;
      font-weight: 600;
      padding: 4px 12px;
      border-radius: var(--radius-full);
    }

    .category-stats {
      display: flex;
      gap: 16px;
      font-size: 12px;
    }

    .category-stat {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .category-stat.fail { color: var(--color-fail); }
    .category-stat.warn { color: var(--color-warn); }
    .category-stat.pass { color: var(--color-pass); }
    /* Muted: a check that took no reading is information, not a problem. */
    .category-stat.not-measured { color: var(--color-text-muted, #6b7280); }

    .category-rules {
      background: var(--color-bg-elevated);
      border: 1px solid var(--color-border);
      border-top: none;
      border-radius: 0 0 var(--radius-lg) var(--radius-lg);
    }

    /* ========================================
       Rule Cards
       ======================================== */
    .rule-card {
      padding: 12px 20px;
      border-bottom: 1px solid var(--color-border-subtle);
      transition: background 0.15s;
    }

    .rule-card:last-child {
      border-bottom: none;
    }

    .rule-card:hover {
      background: var(--color-bg-hover);
    }

    .rule-card.hidden {
      display: none;
    }

    .rule-header {
      display: flex;
      align-items: flex-start;
      gap: 12px;
    }

    .rule-status-icon {
      width: 24px;
      height: 24px;
      border-radius: var(--radius-sm);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      font-size: 14px;
      font-weight: 700;
    }

    .rule-status-icon.fail {
      background: var(--color-fail-bg);
      color: var(--color-fail);
    }

    .rule-status-icon.warn {
      background: var(--color-warn-bg);
      color: var(--color-warn);
    }

    .rule-status-icon.pass {
      background: var(--color-pass-bg);
      color: var(--color-pass);
    }

    .rule-status-icon.notmeasured {
      background: var(--color-neutral-bg);
      color: var(--color-neutral);
    }

    /* Says "we have no reading" once, so the message below does not have to
       carry that job alone at the same weight as a real finding. */
    .rule-notmeasured-tag {
      display: inline-block;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--color-neutral);
      background: var(--color-neutral-bg);
      padding: 2px 8px;
      border-radius: var(--radius-full);
      margin-bottom: 6px;
    }

    .rule-content {
      flex: 1;
      min-width: 0;
    }

    .rule-title-row {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
      margin-bottom: 4px;
    }

    .rule-title {
      font-size: 14px;
      font-weight: 600;
    }

    .rule-id {
      font-family: var(--font-mono);
      font-size: 11px;
      color: var(--color-text-muted);
      font-weight: 400;
      overflow-wrap: anywhere;
    }

    .rule-url {
      font-family: var(--font-mono);
      font-size: 11px;
      color: var(--color-accent);
      background: var(--color-accent-light);
      padding: 2px 8px;
      border-radius: var(--radius-sm);
      text-decoration: none;
      overflow-wrap: anywhere;
    }

    .rule-url:hover {
      text-decoration: underline;
    }

    /* The finding is the only line on the card that changes per audit, so it
       outranks both the rule name above it and the definition below it. */
    .rule-message {
      font-size: 14px;
      line-height: 1.5;
      font-weight: 500;
      color: var(--color-text);
      margin-bottom: 6px;
      /* Findings embed long unbroken URLs; without this they push the card
         past the viewport on narrow screens. */
      overflow-wrap: anywhere;
    }

    /* The rule definition is identical on every audit of every site. It stays
       for reference, below the finding, at a weight that reads as reference. */
    .rule-description {
      font-size: 12px;
      line-height: 1.5;
      color: var(--color-text-muted);
      margin-bottom: 8px;
    }

    .rule-fix > summary {
      cursor: pointer;
      list-style: none;
    }

    .rule-fix > summary::marker,
    .rule-fix > summary::-webkit-details-marker { display: none; }

    .rule-fix {
      margin-top: 8px;
    }

    /* Open, the advice gets its panel; closed, it costs one line. It was 46px
       of every card in a report where cards are 83% of the page. */
    .rule-fix[open] > .rule-fix-text {
      padding: 10px 14px;
      border-left: 3px solid var(--color-info);
      background: var(--color-bg);
      border-radius: 0 var(--radius-md) var(--radius-md) 0;
    }

    .rule-fix-header {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--color-info);
    }

    .rule-fix[open] > .rule-fix-header {
      margin-bottom: 6px;
    }

    .rule-fix-text {
      font-size: 13px;
      color: var(--color-text-secondary);
      line-height: 1.5;
    }

    /* ========================================
       Collapsible Pages List
       ======================================== */
    .pages-toggle {
      margin-top: 8px;
    }

    .pages-toggle summary {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      font-weight: 500;
      color: var(--color-accent);
      cursor: pointer;
      padding: 4px 8px;
      border-radius: var(--radius-sm);
      transition: background 0.15s;
      list-style: none;
    }

    .pages-toggle summary::-webkit-details-marker {
      display: none;
    }

    .pages-toggle summary::before {
      content: '▶';
      font-size: 8px;
      transition: transform 0.2s;
    }

    .pages-toggle[open] summary::before {
      transform: rotate(90deg);
    }

    .pages-toggle summary:hover {
      background: var(--color-accent-light);
    }

    .pages-more {
      font-size: 11px;
      color: var(--color-text-muted);
      align-self: center;
    }

    .pages-list {
      display: flex;
      flex-direction: column;
      gap: 4px;
      margin-top: 8px;
      padding: 8px 12px;
      background: var(--color-bg);
      border-radius: var(--radius-md);
      max-height: 200px;
      overflow-y: auto;
    }

    .pages-list a {
      font-family: var(--font-mono);
      font-size: 11px;
      color: var(--color-accent);
      text-decoration: none;
      padding: 2px 4px;
      border-radius: var(--radius-sm);
      transition: background 0.15s;
    }

    .pages-list a:hover {
      background: var(--color-accent-light);
      text-decoration: underline;
    }

    .pages-inline {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 8px;
    }

    .pages-inline a {
      font-family: var(--font-mono);
      font-size: 11px;
      color: var(--color-accent);
      background: var(--color-accent-light);
      padding: 2px 8px;
      border-radius: var(--radius-sm);
      text-decoration: none;
    }

    .pages-inline a:hover {
      text-decoration: underline;
    }

    .rule-details {
      margin-top: 12px;
      padding: 12px;
      background: var(--color-bg);
      border-radius: var(--radius-md);
      font-size: 12px;
    }

    .rule-detail-item {
      display: flex;
      gap: 8px;
      padding: 4px 0;
      font-family: var(--font-mono);
    }

    .rule-detail-key {
      color: var(--color-text-muted);
      min-width: 120px;
    }

    .rule-detail-value {
      color: var(--color-text-secondary);
      word-break: break-all;
    }

    /* ========================================
       Footer
       ======================================== */
    .footer {
      text-align: center;
      padding: 32px;
      margin-top: 48px;
      border-top: 1px solid var(--color-border);
      font-size: 12px;
      color: var(--color-text-muted);
    }

    .footer-primary {
      font-weight: 600;
      color: var(--color-text-secondary);
    }

    .footer-secondary {
      margin-top: 6px;
    }

    .footer a {
      color: var(--color-accent);
      text-decoration: none;
    }

    .footer a:hover {
      text-decoration: underline;
    }

    /* ========================================
       Responsive
       ======================================== */
    @media (max-width: 1024px) {
      /* The sidebar used to be display:none here, which left a report that can
         run to 17,000 pixels with no way to reach a category except scrolling.
         It becomes a scrollable strip above the content instead: same links,
         same DOM, no JavaScript. */
      .sidebar {
        position: static;
        width: auto;
        height: auto;
        border-right: none;
        border-bottom: 1px solid var(--color-border);
        overflow: visible;
        padding: 12px 0 0;
        /* The header stays fixed, so a static sidebar starts at y=0 and its
           first rows render behind it. */
        margin-top: var(--header-height);
      }
      .sidebar-section {
        margin-bottom: 12px;
        padding: 0;
      }
      .sidebar-nav {
        display: flex;
        gap: 6px;
        overflow-x: auto;
        padding: 0 16px 12px;
        scrollbar-width: thin;
      }
      .sidebar-link {
        white-space: nowrap;
        padding: 8px 12px;
        border: 1px solid var(--color-border);
      }
      /* The category glyph earns no room on a phone; the name and its counter
         are what make the link scannable. */
      .sidebar-link-icon {
        display: none;
      }
      .sidebar-title {
        padding: 0 16px 6px;
      }
      /* Filter and page list are full-width controls here, not a rail. */
      .url-filter {
        padding: 0 16px;
      }
      .main {
        /* The sidebar now carries the header offset in normal flow; keeping it
           here too would leave a header-sized gap between the two. */
        margin-left: 0;
        margin-top: 0;
      }
    }

    @media (max-width: 768px) {
      .header {
        padding: 0 16px;
      }
      .header-url {
        display: none;
      }
      /* The wordmark already names the product, so the lockup sheds its
         qualifiers first rather than wrapping the header. */
      .header-brand-divider,
      .header-brand-product,
      .header-brand-tag {
        display: none;
      }
      .score-overview {
        grid-template-columns: 1fr;
        gap: 20px;
      }
      .score-circle {
        margin: 0 auto;
      }
      /* Five stats in a nowrap row are 11px wider than the card on a 375px
         screen, so "332 Total" broke out past the card's right border. Same
         remedy as .category-header below. */
      .score-stats {
        justify-content: center;
        flex-wrap: wrap;
        gap: 8px 16px;
      }
      .main {
        padding: 16px;
      }
      .issue-row-url {
        display: none;
      }
      /* Category title and its four counters do not fit side by side on a
         phone, and the row was pushing the whole page into a sideways scroll. */
      .category-header {
        flex-wrap: wrap;
        gap: 8px;
      }
      .category-stats {
        flex-wrap: wrap;
      }
    }

    /* ========================================
       Animations
       ======================================== */
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .category-section {
      animation: fadeIn 0.3s ease forwards;
    }

    .category-section:nth-child(1) { animation-delay: 0.05s; }
    .category-section:nth-child(2) { animation-delay: 0.1s; }
    .category-section:nth-child(3) { animation-delay: 0.15s; }
    .category-section:nth-child(4) { animation-delay: 0.2s; }
    .category-section:nth-child(5) { animation-delay: 0.25s; }

    /* Highlight animation for scroll-to */
    @keyframes highlight {
      0% { background: var(--color-accent-light); }
      100% { background: transparent; }
    }

    .rule-card.highlight {
      animation: highlight 1.5s ease;
    }

    /* ========================================
       Print Styles
       ======================================== */
    /* The report animates the score ring and every hover; honour a reader who
       has asked their system for less motion. There was no such rule at all. */
    @media (prefers-reduced-motion: reduce) {
      *,
      *::before,
      *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
        scroll-behavior: auto !important;
      }
    }

    @media print {
      .header, .sidebar, .filter-bar, .theme-toggle {
        display: none !important;
      }
      .main {
        margin: 0;
        padding: 20px;
      }
      .rule-card {
        break-inside: avoid;
      }
    }
  `;
}

/**
 * Generate JavaScript for interactivity.
 *
 * `pages` is emitted here once. It used to be repeated as a full URL list on
 * every table row and every rule card — 20.6MB across 350 attributes on a
 * 1,000-page crawl, of data the document already contained.
 */
function generateScript(pages: string[]): string {
  return `
    (function() {
      // The report's page list, in the order the filter offers them. Findings
      // reference it by index.
      const REPORT_PAGES = ${JSON.stringify(pages)};
      // Theme toggle
      const themeToggle = document.querySelector('.theme-toggle');
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const savedTheme = localStorage.getItem('seo-audit-theme');

      if (savedTheme) {
        document.documentElement.setAttribute('data-theme', savedTheme);
      } else if (prefersDark) {
        document.documentElement.setAttribute('data-theme', 'dark');
      }

      themeToggle.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('seo-audit-theme', next);
      });

      // State
      let currentStatusFilter = 'all';
      let currentUrlFilter = 'all';
      // -1 means "all pages". Findings carry indices into REPORT_PAGES rather
      // than a repeated copy of every URL they cover.
      let currentPageIndex = -1;

      // Does this element's page set include the selected page?
      function matchesPage(el) {
        if (currentPageIndex < 0) return true;
        const bits = el.dataset.pages;
        // No attribution at all, or every page: always shown.
        if (!bits || bits === '*') return true;
        return bits.split(',').indexOf(String(currentPageIndex)) !== -1;
      }

      // Elements
      const filterTabs = document.querySelectorAll('.filter-tab');
      const ruleCards = document.querySelectorAll('.rule-card');
      const categorySections = document.querySelectorAll('.category-section');
      const issueRows = document.querySelectorAll('.issue-row');
      const urlFilter = document.getElementById('url-filter');

      // Apply filters
      function applyFilters() {
        // Filter rule cards - supports multiple URLs in data-urls attribute
        ruleCards.forEach(card => {
          const status = card.dataset.status;
          const statusMatch = currentStatusFilter === 'all' || status === currentStatusFilter;
          card.classList.toggle('hidden', !(statusMatch && matchesPage(card)));
        });

        // Filter issue rows in summary table - supports multiple URLs
        issueRows.forEach(row => {
          const status = row.dataset.status;
          const statusMatch = currentStatusFilter === 'all' || status === currentStatusFilter;
          row.classList.toggle('hidden', !(statusMatch && matchesPage(row)));
        });

        // Hide empty categories
        categorySections.forEach(section => {
          const visibleRules = section.querySelectorAll('.rule-card:not(.hidden)');
          section.style.display = visibleRules.length === 0 ? 'none' : 'block';
        });

        // The fold must never hide what the reader explicitly asked to see:
        // filtering to Passed with the passed checks folded away would show an
        // empty report. Selecting 'All' leaves the fold as the reader left it.
        document.querySelectorAll('details.quiet-rules').forEach(fold => {
          const visible = fold.querySelectorAll('.rule-card:not(.hidden)').length;
          fold.style.display = visible === 0 ? 'none' : '';
          if (currentStatusFilter === 'pass' || currentStatusFilter === 'notmeasured') {
            fold.open = true;
          } else if (currentStatusFilter !== 'all') {
            fold.open = false;
          }
        });

        // Update counts in filter tabs
        updateFilterCounts();
      }

      function updateFilterCounts() {
        const visible = {
          all: 0,
          fail: 0,
          warn: 0,
          pass: 0,
          notmeasured: 0
        };

        ruleCards.forEach(card => {
          const status = card.dataset.status;
          if (matchesPage(card)) {
            visible.all++;
            if (status === 'fail') visible.fail++;
            if (status === 'warn') visible.warn++;
            if (status === 'pass') visible.pass++;
            if (status === 'notmeasured') visible.notmeasured++;
          }
        });

        filterTabs.forEach(tab => {
          const filter = tab.dataset.filter;
          const countEl = tab.querySelector('.filter-tab-count');
          if (countEl && visible[filter] !== undefined) {
            countEl.textContent = visible[filter];
          }
        });
      }

      // Status filter tabs
      filterTabs.forEach(tab => {
        tab.addEventListener('click', () => {
          filterTabs.forEach(t => t.classList.remove('active'));
          tab.classList.add('active');
          currentStatusFilter = tab.dataset.filter;
          applyFilters();
        });
      });

      // URL filter dropdown
      if (urlFilter) {
        urlFilter.addEventListener('change', () => {
          currentUrlFilter = urlFilter.value;
          // Resolved once here rather than string-matched on every element.
          currentPageIndex = currentUrlFilter === 'all' ? -1 : REPORT_PAGES.indexOf(currentUrlFilter);
          applyFilters();
        });
      }

      // Click-to-scroll from issues table
      issueRows.forEach(row => {
        row.addEventListener('click', () => {
          const ruleId = row.dataset.ruleId;
          const url = row.dataset.url;

          // Find matching card (match both ruleId and url if multi-page)
          let targetCard = null;
          ruleCards.forEach(card => {
            if (card.dataset.ruleId === ruleId) {
              if (!url || card.dataset.url === url) {
                targetCard = card;
              }
            }
          });

          if (targetCard) {
            // Make sure it's visible
            targetCard.classList.remove('hidden');
            targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
            targetCard.classList.add('highlight');
            setTimeout(() => targetCard.classList.remove('highlight'), 1500);
          }
        });
      });

      // Sidebar navigation
      const sidebarLinks = document.querySelectorAll('.sidebar-link[data-category]');
      sidebarLinks.forEach(link => {
        link.addEventListener('click', (e) => {
          e.preventDefault();
          const categoryId = link.dataset.category;
          const targetSection = document.getElementById('category-' + categoryId);
          if (targetSection) {
            targetSection.scrollIntoView({ behavior: 'smooth' });
            sidebarLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
          }
        });
      });

      // Update active sidebar link on scroll
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const categoryId = entry.target.id.replace('category-', '');
            sidebarLinks.forEach(l => {
              l.classList.toggle('active', l.dataset.category === categoryId);
            });
          }
        });
      }, { threshold: 0.3, rootMargin: '-100px 0px -50% 0px' });

      categorySections.forEach(section => observer.observe(section));
    })();
  `;
}

/**
 * The SEOmator wordmark, inlined so the report stays a single self-contained
 * file with no network fetch for its own branding.
 *
 * The paths are the designer's `electron/resources/brand/seomator-logo.svg`,
 * byte for byte. The emblem stays orange on both themes; the lettering inherits
 * `currentColor`, which is how the designer's light and dark files differ.
 * Unfilled lettering would default to black and vanish against the dark theme.
 *
 * Emblem plus lettering, roughly 5.7:1, so it is sized by height and left to
 * find its own width.
 */
/** Where the header lockup and the footer send readers for the hosted tool. */
const SEOMATOR_TOOL_URL = 'https://seomator.com/free-seo-audit-tool';

const SEOMATOR_WORDMARK =
  '<svg viewBox="0 0 850 150" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="SEOmator"><path d="M75 5C27.1762 5 5 26.7323 5 75C5 123.268 27.1762 145 75 145C122.824 145 145 123.268 145 75C145 26.7323 122.832 5 75 5Z" fill="#FE5000"/><g filter="url(#seomator-visor-shadow)"><path d="M74.9825 53C4.58302 53.9094 -3.78745 135.394 74.9825 134.999C153.752 135.356 145.478 53.9543 74.9825 53Z" fill="white"/></g><path d="M100.114 91.3539C100.938 101.56 106.033 109.452 111.493 108.98C116.953 108.508 120.711 99.8523 119.886 89.6461C119.062 79.4399 113.967 71.5485 108.507 72.0201C103.047 72.4917 99.2888 81.1477 100.114 91.3539Z" fill="#FE5000"/><path d="M68.2375 93.9149C69.5702 105.763 76.1406 114.734 82.913 113.953C89.6854 113.171 94.0951 102.933 92.7625 91.0851C91.4298 79.2371 84.8594 70.266 78.087 71.0474C71.3146 71.8289 66.9049 82.067 68.2375 93.9149Z" fill="#FE5000"/><g fill="currentColor"><path d="M820.43 115.706H798.152V38.0013H819.283V63.2472H821.085C825.999 41.6079 832.552 37.1816 842.708 37.1816H845.001V62.7554H840.414C824.853 62.7554 820.43 67.3456 820.43 81.1161V115.706Z"/><path d="M748.011 118C722.785 118 707.879 102.427 707.879 76.8527C707.879 50.9511 723.277 35.8691 748.011 35.8691C772.255 35.8691 787.816 50.9511 787.816 76.8527C787.816 102.427 772.746 118 748.011 118ZM747.848 54.5577C735.562 54.5577 730.157 62.5905 730.157 76.6888C730.157 90.7872 735.235 98.9839 747.848 98.9839C760.297 98.9839 765.539 90.7872 765.539 76.6888C765.539 62.5905 760.133 54.5577 747.848 54.5577Z"/><path d="M658.192 91.2787V55.7049H648.691V38H658.192V18H680.47V38H700.946V55.7049H680.47V87.6721C680.47 93.9016 682.763 97.0164 689.479 97.0164C692.919 97.0164 696.687 96.0328 699.635 95.0492L702.092 115.049C696.195 116.852 692.264 118 683.746 118C665.727 118 658.192 106.033 658.192 91.2787Z"/><path d="M601.98 98.3282C611.481 98.3282 617.706 91.4429 617.706 80.6232V74.5577C617.706 63.2462 611.645 56.0331 601.817 56.0331C591.169 56.0331 586.255 62.9183 586.255 77.5085C586.255 91.4429 591.005 98.3282 601.98 98.3282ZM564.469 77.5085C564.469 50.4593 574.297 35.8691 591.333 35.8691C603.782 35.8691 612.136 44.0659 616.231 57.6724H617.706V38.0003H639.983V115.705H617.706V95.3773H616.395C612.464 108.984 603.946 118 591.005 118C574.297 118 564.469 103.738 564.469 77.5085Z"/><path d="M455.379 72.4265V115.705H433.102V38.0003H454.888V58.82H456.526C460.949 43.738 470.286 35.8691 482.571 35.8691C496.331 35.8691 503.047 44.5577 504.03 59.1478H505.831C510.09 43.9019 518.936 35.8691 531.713 35.8691C546.947 35.8691 554.646 46.197 554.646 63.0823V115.705H532.204V69.3118C532.204 61.4429 528.6 56.0331 520.41 56.0331C510.909 56.0331 505.012 62.7544 505.012 72.4265V115.705H482.735V69.3118C482.735 61.4429 478.967 56.0331 470.941 56.0331C461.44 56.0331 455.379 62.7544 455.379 72.4265Z"/><path d="M382.961 118C357.734 118 342.828 102.427 342.828 76.8527C342.828 50.9511 358.226 35.8691 382.961 35.8691C407.204 35.8691 422.765 50.9511 422.765 76.8527C422.765 102.427 407.695 118 382.961 118ZM382.797 54.5577C370.511 54.5577 365.106 62.5905 365.106 76.6888C365.106 90.7872 370.184 98.9839 382.797 98.9839C395.246 98.9839 400.488 90.7872 400.488 76.6888C400.488 62.5905 395.082 54.5577 382.797 54.5577Z"/><path d="M300.114 52.5904C289.959 52.5904 284.225 57.8364 283.079 70.6232H315.512C315.185 58.4921 310.107 52.5904 300.114 52.5904ZM300.442 117.836C277.018 117.836 260.965 104.886 260.965 78.4921C260.965 51.6068 275.544 35.8691 300.77 35.8691C324.685 35.8691 335.988 49.9675 335.988 71.4429C335.988 74.7216 335.824 77.8364 335.497 81.9347H282.915C284.225 94.3937 289.959 99.9675 300.606 99.9675C311.089 99.9675 314.366 95.0495 316.331 89.1478L335.005 94.2298C331.565 107.672 322.556 117.836 300.442 117.836Z"/><path d="M221.365 118C195.156 118 187.129 107.509 185 93.4103L204.984 89.3119C206.95 97.8365 212.192 102.263 221.856 102.263C229.391 102.263 233.159 99.8037 233.323 94.7218C233.323 89.9677 230.21 87.3447 215.959 84.5578C194.665 79.9677 187.457 72.9185 187.457 59.6398C187.457 44.7218 198.104 35.8693 220.054 35.8693C242.66 35.8693 250.031 44.7218 252.816 58.3283L232.995 62.4267C231.193 54.3939 227.59 51.2792 219.563 51.2792C212.192 51.2792 208.588 53.7382 208.588 58.3283C208.588 62.5906 210.718 65.7054 224.641 68.4923C248.884 73.5742 254.781 81.607 254.781 93.7382C254.781 108.82 244.789 118 221.365 118Z"/></g><defs><filter id="seomator-visor-shadow" x="19" y="47" width="112" height="88" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB"><feFlood flood-opacity="0" result="BackgroundImageFix"/><feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/><feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/><feOffset dy="-6"/><feGaussianBlur stdDeviation="6"/><feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1"/><feColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 0.696922 0 0 0 0 0.556472 0 0 0 0.8 0"/><feBlend mode="normal" in2="shape" result="effect1_innerShadow_1_2594"/></filter></defs></svg>';

/** The emblem alone as an SVG data URI: the report's tab icon, with no file to fetch. */
const SEOMATOR_FAVICON =
  'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxNTAgMTUwIj48cGF0aCBmaWxsPSIjRkU1MDAwIiBkPSJNNzUgNUMyNy4xNzYyIDUgNSAyNi43MzIzIDUgNzVDNSAxMjMuMjY4IDI3LjE3NjIgMTQ1IDc1IDE0NUMxMjIuODI0IDE0NSAxNDUgMTIzLjI2OCAxNDUgNzVDMTQ1IDI2LjczMjMgMTIyLjgzMiA1IDc1IDVaIi8+PHBhdGggZmlsbD0iI2ZmZiIgZD0iTTc0Ljk4MjUgNTNDNC41ODMwMiA1My45MDk0IC0zLjc4NzQ1IDEzNS4zOTQgNzQuOTgyNSAxMzQuOTk5QzE1My43NTIgMTM1LjM1NiAxNDUuNDc4IDUzLjk1NDMgNzQuOTgyNSA1M1oiLz48cGF0aCBmaWxsPSIjRkU1MDAwIiBkPSJNNjguMjM3NSA5My45MTQ5QzY5LjU3MDIgMTA1Ljc2MyA3Ni4xNDA2IDExNC43MzQgODIuOTEzIDExMy45NTNDODkuNjg1NCAxMTMuMTcxIDk0LjA5NTEgMTAyLjkzMyA5Mi43NjI1IDkxLjA4NTFDOTEuNDI5OCA3OS4yMzcxIDg0Ljg1OTQgNzAuMjY2IDc4LjA4NyA3MS4wNDc0QzcxLjMxNDYgNzEuODI4OSA2Ni45MDQ5IDgyLjA2NyA2OC4yMzc1IDkzLjkxNDlaIi8+PHBhdGggZmlsbD0iI0ZFNTAwMCIgZD0iTTEwMC4xMTQgOTEuMzUzOUMxMDAuOTM4IDEwMS41NiAxMDYuMDMzIDEwOS40NTIgMTExLjQ5MyAxMDguOThDMTE2Ljk1MyAxMDguNTA4IDEyMC43MTEgOTkuODUyMyAxMTkuODg2IDg5LjY0NjFDMTE5LjA2MiA3OS40Mzk5IDExMy45NjcgNzEuNTQ4NSAxMDguNTA3IDcyLjAyMDFDMTAzLjA0NyA3Mi40OTE3IDk5LjI4ODggODEuMTQ3NyAxMDAuMTE0IDkxLjM1MzlaIi8+PC9zdmc+';

/**
 * Generate SVG icons
 */
function getIcon(name: string): string {
  const icons: Record<string, string> = {
    logo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/><path d="M11 8v6M8 11h6"/></svg>',
    moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>',
    sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>',
    check: '✓',
    warning: '!',
    error: '✕',
    lightbulb: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M9 21h6M12 3a6 6 0 0 0-3 11.2V17h6v-2.8A6 6 0 0 0 12 3z"/></svg>',
    category: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>',
    pages: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/></svg>',
  };
  return icons[name] || '';
}

/**
 * Generate HTML report for audit result
 * @param result - Audit result to render
 * @returns Complete HTML string
 */

/** Hostname for display, falling back to the raw string a stored audit may hold */
function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

/**
 * Render the page snapshot: headline counts, the search and social previews,
 * and the heading outline.
 *
 * Returns an empty string for crawl runs, which have many pages and therefore
 * no single page to preview.
 *
 * @param page - Snapshot captured during the audit
 * @param url - Audited URL, shown in the search preview
 */
function renderPageSnapshot(page: PageSnapshot | undefined, url: string): string {
  if (!page) return '';

  const { metrics } = page;
  const metricCards = [
    { value: metrics.wordCount.toLocaleString(), label: 'Words' },
    { value: String(metrics.internalLinks), label: 'Internal Links' },
    { value: String(metrics.externalLinks), label: 'External Links' },
    { value: String(metrics.images), label: 'Images' },
    { value: `${metrics.textRatio}%`, label: 'Text Ratio' },
    { value: String(page.headings.length), label: 'Headings' },
  ]
    .map(
      (m) => `
        <div class="snapshot-metric">
          <span class="snapshot-metric-value">${escapeHtml(m.value)}</span>
          <span class="snapshot-metric-label">${escapeHtml(m.label)}</span>
        </div>`
    )
    .join('');

  // Fall back the way the platforms themselves do: a social card with no
  // og:title shows the page title, so the preview should too.
  const socialTitle = page.og.title ?? page.title;
  const socialDescription = page.og.description ?? page.description;
  const missing = (what: string) => `<span class="snapshot-missing">No ${escapeHtml(what)}</span>`;

  const socialCard = `
    <div class="social-card">
      ${
        page.og.image
          ? `<img class="social-card-image" src="${escapeHtml(page.og.image)}" alt="" loading="lazy">`
          : ''
      }
      <div class="social-card-body">
        <div class="social-card-site">${escapeHtml(page.og.siteName ?? hostnameOf(url))}</div>
        <div class="social-card-title">${socialTitle ? escapeHtml(socialTitle) : missing('og:title or title')}</div>
        <div class="social-card-description">${
          socialDescription ? escapeHtml(socialDescription) : missing('og:description or meta description')
        }</div>
      </div>
    </div>`;

  const outline = page.headings.length
    ? `<ol class="heading-outline">${page.headings
        .map(
          (h) => `
        <li style="padding-left: ${(h.level - 1) * 14}px">
          <span class="heading-level h${h.level}">H${h.level}</span>
          <span class="heading-text">${escapeHtml(h.text)}</span>
        </li>`
        )
        .join('')}</ol>`
    : `<p class="snapshot-missing">No headings found on the page</p>`;

  return `
      <div class="snapshot-metrics">${metricCards}</div>
      <div class="snapshot-panels">
        <section class="snapshot-panel">
          <h2 class="snapshot-panel-title">Search &amp; Social Preview</h2>
          <div class="snapshot-subtitle">Google result</div>
          <div class="serp-preview">
            <div class="serp-url">${escapeHtml(page.canonical ?? url)}</div>
            <div class="serp-title">${page.title ? escapeHtml(page.title) : missing('title tag')}</div>
            <div class="serp-description">${
              page.description ? escapeHtml(page.description) : missing('meta description')
            }</div>
          </div>
          <div class="snapshot-subtitle">Social card${
            page.twitterCard ? ` (twitter:card = ${escapeHtml(page.twitterCard)})` : ''
          }</div>
          ${socialCard}
        </section>
        <section class="snapshot-panel">
          <h2 class="snapshot-panel-title">Heading Outline</h2>
          ${outline}
        </section>
      </div>`;
}

export function renderHtmlReport(result: AuditResult): string {
  const scoreColor = getScoreColor(result.overallScore);
  const scoreLabel = scoreToVerdict(result.overallScore).label;
  const timestamp = new Date(result.timestamp).toLocaleString();
  const isPassing = result.overallScore >= 70;

  // Build rule metadata cache for efficient lookups
  const ruleMetadataCache = buildRuleMetadataCache(result.categoryResults);

  // Build aggregated issues by rule
  const aggregatedByCategory = aggregateIssuesByRule(result.categoryResults, ruleMetadataCache);

  // Collect all unique URLs
  const allUrls = new Set<string>();
  for (const categoryResult of result.categoryResults) {
    for (const ruleResult of categoryResult.results) {
      const url = extractUrlFromDetails(ruleResult.details);
      if (url) allUrls.add(url);
    }
  }

  // Flatten all aggregated issues for counting (these are unique rule+status combinations)
  const allAggregatedIssues: AggregatedIssue[] = [];
  for (const issues of aggregatedByCategory.values()) {
    allAggregatedIssues.push(...issues);
  }

  const failures = allAggregatedIssues.filter(i => i.status === 'fail');
  const warnings = allAggregatedIssues.filter(i => i.status === 'warn');
  const passes = allAggregatedIssues.filter(i => i.status === 'pass');
  const notMeasured = allAggregatedIssues.filter(i => i.status === 'notmeasured');
  const totalChecks = allAggregatedIssues.length;
  // Prefer the audit's own page list. Scraping URLs back out of rule details
  // only ever recovers pages that some rule happened to name, so a page with no
  // attributable finding disappeared: an eight-page crawl listed seven.
  const coverage = result.coverage;
  const uniqueUrls = coverage ? [...coverage.pages] : Array.from(allUrls).sort();

  // Built once and shared by both emission sites below.
  const pageIndexOf = new Map(uniqueUrls.map((url, index) => [url, index]));

  // A per-page filter is only honest when every rule result carries its own
  // page. Aggregated results keep one row per rule with a capped sample of
  // pages, so filtering by page would hide most of what it claims to show.
  const canFilterByPage = coverage ? coverage.detail === 'per-page' : true;

  // Drives every per-rule page link. Read from the URLs the rules actually
  // reported rather than from `crawledPages`, so a crawl that resolved to one
  // page is treated as the single-page report it is.
  const isMultiPageReport = uniqueUrls.length > 1;

  // Calculate circumference for score circle
  const radius = 58;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (result.overallScore / 100) * circumference;

  // Generate issues table rows (failures and warnings only) - now using
  // aggregated data, ordered by what actually deserves attention first.
  // Severity still leads, because a failure outranks a warning whatever its
  // weight; within a severity the ranker decides, so a weight-25 finding no
  // longer sits below a weight-1 one that happens to register earlier.
  const byPriority = (a: AggregatedIssue, b: AggregatedIssue) =>
    b.priority - a.priority ||
    b.pageCount - a.pageCount ||
    a.ruleId.localeCompare(b.ruleId);

  // The table and the category sections below rendered the same 46 findings
  // twice — 3,191px of rows and 12,217px of cards, 90% of a 17,199px page. The
  // table is a ranked index now: what to fix first, linking down to the detail.
  const rankedIssues = [...failures.sort(byPriority), ...warnings.sort(byPriority)];
  const TOP_ISSUES = 10;
  const issueTableRows = rankedIssues
    .slice(0, TOP_ISSUES)
    .map((issue) => {
      const pageBits = encodePages(issue.pages.map(p => p.url), pageIndexOf, uniqueUrls.length);
      const pageDisplay = issue.pages.length === 0
        ? '-'
        : issue.pages.length === 1
          ? `<span class="issue-row-url" title="${escapeHtml(issue.pages[0].url)}">${escapeHtml(getShortUrl(issue.pages[0].url))}</span>`
          : `<span class="issue-row-url">${issue.pages.length} pages</span>`;

      return `
      <tr class="issue-row" data-rule-id="${escapeHtml(issue.ruleId)}" data-status="${issue.status}" data-pages="${pageBits}">
        <td>
          <div class="issue-row-name">
            <div class="issue-row-icon ${issue.status}">${STATUS_ICONS[issue.status]}</div>
            <div>
              <div class="issue-row-text">${escapeHtml(issue.ruleName)}</div>
              <div class="issue-row-category">${escapeHtml(issue.categoryName)}</div>
            </div>
          </div>
        </td>
        ${isMultiPageReport ? `<td>${pageDisplay}</td>` : ''}
        <td>
          <span class="issue-row-severity ${issue.status}">${issue.status === 'fail' ? 'Critical' : 'Warning'}</span>
        </td>
      </tr>
    `;
    }).join('');

  // Generate URL filter options
  const urlFilterOptions = uniqueUrls.length > 1 && canFilterByPage
    ? `<option value="all">All pages (${uniqueUrls.length})</option>
       ${uniqueUrls.map(url => `<option value="${escapeHtml(url)}">${escapeHtml(getShortUrl(url))}</option>`).join('')}`
    : '';

  // When the results are aggregated the pages are still worth showing — every
  // rule below reports how many of them it affected — but they cannot be
  // filtered on, so they are presented as the list they are.
  const pagesCovered = uniqueUrls.length > 1 && !canFilterByPage
    ? `<details class="pages-covered">
         <summary>${uniqueUrls.length} pages audited</summary>
         <ul>
           ${uniqueUrls.map(url => `<li><a href="${escapeHtml(url)}" target="_blank" rel="noopener">${escapeHtml(getShortUrl(url))}</a></li>`).join('')}
         </ul>
       </details>`
    : '';

  // Generate sidebar links
  const sidebarLinks = result.categoryResults.map(cat => {
    const category = getCategoryById(cat.categoryId);
    const categoryName = category?.name ?? cat.categoryId;
    const issueCount = cat.failCount + cat.warnCount;
    const countClass = cat.failCount > 0 ? 'fail' : cat.warnCount > 0 ? 'warn' : 'pass';

    return `
      <li>
        <a class="sidebar-link" data-category="${cat.categoryId}">
          <span class="sidebar-link-icon">${getIcon('category')}</span>
          ${escapeHtml(categoryName)}
          ${issueCount > 0 ? `<span class="sidebar-link-count ${countClass}">${issueCount}</span>` : ''}
        </a>
      </li>
    `;
  }).join('');

  // Helper function to generate pages list HTML
  const generatePagesListHtml = (pages: Array<{ url: string; details: Record<string, unknown> }>): string => {
    if (pages.length === 0) return '';

    // A per-rule page link answers "which of the crawled pages is this about".
    // With one page in the whole report there is nothing to disambiguate, and
    // the link repeats on every card — hundreds of identical chips that are the
    // only coloured element on each one. The page is named once in the header
    // instead.
    if (!isMultiPageReport) return '';

    // For single page, show inline
    if (pages.length === 1) {
      return `
        <div class="pages-inline">
          <a href="${escapeHtml(pages[0].url)}" target="_blank" rel="noopener">${escapeHtml(getShortUrl(pages[0].url))}</a>
        </div>
      `;
    }

    // For 2-3 pages, show inline
    if (pages.length <= 3) {
      return `
        <div class="pages-inline">
          ${pages.map(p => `<a href="${escapeHtml(p.url)}" target="_blank" rel="noopener">${escapeHtml(getShortUrl(p.url))}</a>`).join('')}
        </div>
      `;
    }

    // For 4+ pages, use collapsible list.
    //
    // Capped, because `<details>` hides these visually and puts every one of
    // them in the DOM regardless. On a 1,000-page crawl that meant 340 rules x
    // 1,000 anchors: 340,004 links and 48MB of a 69MB file, for a list nobody
    // reads past the first few. The count is the useful part; the URLs are a
    // sample of where to look.
    const shown = pages.slice(0, MAX_LISTED_PAGES);
    const rest = pages.length - shown.length;
    return `
      <details class="pages-toggle">
        <summary>${pages.length} pages affected</summary>
        <div class="pages-list">
          ${shown.map(p => `<a href="${escapeHtml(p.url)}" target="_blank" rel="noopener">${escapeHtml(getShortUrl(p.url))}</a>`).join('')}
          ${rest > 0 ? `<span class="pages-more">and ${rest.toLocaleString()} more</span>` : ''}
        </div>
      </details>
    `;
  };

  // Generate category sections using aggregated issues
  const categorySectionsHtml = result.categoryResults.map(cat => {
    const category = getCategoryById(cat.categoryId);
    const categoryName = category?.name ?? cat.categoryId;
    const categoryColor = getScoreColor(cat.score);

    // Get aggregated issues for this category
    const aggregatedIssues = aggregatedByCategory.get(cat.categoryId) || [];

    // What the reader came for goes first, ranked; what passed or was never
    // measured is kept but folded away. Rendering all 332 rules expanded is
    // what made this report 54,000 pixels tall, and the 278 that passed are
    // the part nobody scrolls to.
    // `[rules.override]` priority = "ignore" takes a finding out of the
    // ranked list, but never out of the report: it sits in its own fold.
    const ignoredByConfig = (i: AggregatedIssue) =>
      i.override === 'ignore' && i.status !== 'pass';
    const actionable = aggregatedIssues
      .filter(i => (i.status === 'fail' || i.status === 'warn') && !ignoredByConfig(i))
      .sort(byPriority);
    const quiet = aggregatedIssues.filter(
      i => (i.status === 'pass' || i.status === 'notmeasured') && !ignoredByConfig(i)
    );
    const ignored = aggregatedIssues.filter(ignoredByConfig);

    const renderIssue = (issue: AggregatedIssue) => {
      const fix = getFixSuggestion(issue.ruleId);
      const statusIcon = STATUS_ICONS[issue.status];
      const pageBits = encodePages(issue.pages.map(p => p.url), pageIndexOf, uniqueUrls.length);

      // Generate pages list HTML (collapsible for 4+ pages)
      const pagesHtml = generatePagesListHtml(issue.pages);

      // The rule's generic description ("checks that the page has a title")
      // sat under the finding's own message ("title is 51 characters"): noise
      // while scanning, and it was on every one of the cards that make up most
      // of the page. For a finding with advice it moves inside that advice,
      // where the reader has stopped scanning and started reading. For a check
      // that passed there is no advice to hold it, and it is the only context
      // the card has — so it stays where it was, one line under the result.
      const description =
        issue.ruleDescription && issue.ruleDescription !== issue.message
          ? issue.ruleDescription
          : '';
      const descriptionHtml = description
        ? `<div class="rule-description">${escapeHtml(description)}</div>`
        : '';

      // Fix advice belongs to results that found something wrong. Offering it
      // for a check that took no reading told readers to optimise a metric
      // nobody had measured.
      const fixHtml = issue.status === 'fail' || issue.status === 'warn'
        ? `<details class="rule-fix">
            <summary class="rule-fix-header">
              ${getIcon('lightbulb')}
              <span>How to fix</span>
            </summary>
            ${descriptionHtml}
            <div class="rule-fix-text">${escapeHtml(fix)}</div>
          </details>`
        : '';

      return `
        <div class="rule-card" data-status="${issue.status}" data-rule-id="${escapeHtml(issue.ruleId)}" data-pages="${pageBits}">
          <div class="rule-header">
            <div class="rule-status-icon ${issue.status}">${statusIcon}</div>
            <div class="rule-content">
              <div class="rule-title-row">
                <span class="rule-title">${escapeHtml(issue.ruleName)}</span>
                <span class="rule-id">${escapeHtml(issue.ruleId)}</span>
              </div>
              ${issue.status === 'notmeasured' ? '<div class="rule-notmeasured-tag">Not measured</div>' : ''}
              <div class="rule-message">${escapeHtml(issue.message)}</div>
              ${fixHtml ? '' : descriptionHtml}
              ${pagesHtml}
              ${fixHtml}
            </div>
          </div>
        </div>
      `;
    };

    const actionableHtml = actionable.map(renderIssue).join('');

    // `<details>` rather than a class toggle, so the fold works with no
    // JavaScript and the browser handles find-in-page inside it.
    const quietHtml = quiet.length
      ? `<details class="quiet-rules">
           <summary>${quiet.length} ${quiet.length === 1 ? 'check that needs' : 'checks that need'} no action</summary>
           <div class="quiet-rules-body">${quiet.map(renderIssue).join('')}</div>
         </details>`
      : '';

    const ignoredHtml = ignored.length
      ? `<details class="quiet-rules">
           <summary>Ignored by config (${ignored.length})</summary>
           <div class="quiet-rules-body">${ignored.map(renderIssue).join('')}</div>
         </details>`
      : '';

    const rulesHtml = actionableHtml + quietHtml + ignoredHtml;

    return `
      <section class="category-section" id="category-${cat.categoryId}">
        <div class="category-header">
          <div class="category-title">
            <span class="category-name">${escapeHtml(categoryName)}</span>
            <span class="category-score" style="background: ${getScoreBackground(cat.score)}; color: ${categoryColor}">${cat.score}/100</span>
          </div>
          <div class="category-stats">
            <span class="category-stat pass">${cat.passCount} passed</span>
            <span class="category-stat warn">${cat.warnCount} warnings</span>
            <span class="category-stat fail">${cat.failCount} failed</span>
            ${
              (cat.notMeasuredCount ?? 0) > 0
                ? `<span class="category-stat not-measured">${cat.notMeasuredCount} not measured</span>`
                : ''
            }
          </div>
        </div>
        <div class="category-rules">
          ${rulesHtml}
        </div>
      </section>
    `;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SEO Audit Report - ${escapeHtml(result.url)}</title>
  <link rel="icon" type="image/svg+xml" href="${SEOMATOR_FAVICON}">
  <style>${generateStyles()}</style>
</head>
<body>
  <!-- Fixed Header -->
  <header class="header">
    <a class="header-brand" href="${SEOMATOR_TOOL_URL}" target="_blank" rel="noopener">
      <span class="header-logo">${SEOMATOR_WORDMARK}</span>
      <span class="header-brand-divider"></span>
      <span class="header-brand-product">SEO Audit</span>
      <span class="header-brand-tag">Open Source</span>
    </a>
    <div class="header-url">
      <a href="${escapeHtml(result.url)}" target="_blank" rel="noopener">${escapeHtml(result.url)}</a>
    </div>
    <div class="header-meta">
      <div class="header-meta-item">
        ${getIcon('pages')}
        <span>${
          isMultiPageReport
            ? `${uniqueUrls.length} pages`
            : escapeHtml(getShortUrl(result.url))
        }</span>
      </div>
      <div class="header-meta-item">
        <span>${timestamp}</span>
      </div>
      <button class="theme-toggle" title="Toggle dark mode">
        <span class="icon-moon">${getIcon('moon')}</span>
        <span class="icon-sun">${getIcon('sun')}</span>
      </button>
    </div>
  </header>

  <!-- Sidebar Navigation -->
  <nav class="sidebar">
    ${urlFilterOptions ? `
    <div class="url-filter">
      <label class="url-filter-label" for="url-filter">Filter by page</label>
      <select id="url-filter" class="url-filter-select">
        ${urlFilterOptions}
      </select>
    </div>
    ` : pagesCovered ? `<div class="url-filter">${pagesCovered}</div>` : ''}
    <div class="sidebar-section">
      <div class="sidebar-title">Categories</div>
      <ul class="sidebar-nav">
        ${sidebarLinks}
      </ul>
    </div>
  </nav>

  <!-- Main Content -->
  <main class="main">
    <div class="content">
      <!-- Score Overview -->
      <div class="score-overview">
        <div class="score-circle">
          <svg width="140" height="140">
            <circle class="score-circle-bg" cx="70" cy="70" r="${radius}"/>
            <circle class="score-circle-progress" cx="70" cy="70" r="${radius}"
                    stroke="${scoreColor}"
                    stroke-dasharray="${circumference}"
                    stroke-dashoffset="${dashOffset}"/>
          </svg>
          <div class="score-circle-text">
            <span class="score-value" style="color: ${scoreColor}">${result.overallScore}</span>
            <span class="score-label">${scoreLabel}</span>
          </div>
        </div>
        <div class="score-details">
          <div class="score-status ${isPassing ? 'pass' : 'fail'}">
            ${isPassing ? '✓ Audit Passed' : '✕ Audit Failed'} (threshold: 70)
          </div>
          ${result.scoreCap ? `<div class="score-cap">
            Capped from ${result.scoreCap.uncappedScore}, the category average:
            <ul>${result.scoreCap.caps.map((cap) => `<li>${escapeHtml(cap.reason)}</li>`).join('')}</ul>
          </div>` : ''}
          ${result.waivedCaps ? `<div class="score-cap">
            Waived for staging, would cap the score in production:
            <ul>${result.waivedCaps.map((cap) => `<li>${escapeHtml(cap.reason)} (cap ${cap.ceiling})</li>`).join('')}</ul>
          </div>` : ''}
          <div class="score-stats">
            <div class="score-stat">
              <span class="score-stat-value fail">${failures.length}</span>
              <span class="score-stat-label">Failures</span>
            </div>
            <div class="score-stat">
              <span class="score-stat-value warn">${warnings.length}</span>
              <span class="score-stat-label">Warnings</span>
            </div>
            <div class="score-stat">
              <span class="score-stat-value pass">${passes.length}</span>
              <span class="score-stat-label">Passed</span>
            </div>
            ${notMeasured.length > 0 ? `
            <div class="score-stat">
              <span class="score-stat-value not-measured">${notMeasured.length}</span>
              <span class="score-stat-label">Not measured</span>
            </div>
            ` : ''}
            <div class="score-stat">
              <span class="score-stat-value">${totalChecks}</span>
              <span class="score-stat-label">Total</span>
            </div>
          </div>
          </div>
        </div>
      </div>

      <!-- Page Snapshot -->
      ${renderPageSnapshot(result.page, result.url)}

      ${failures.length + warnings.length > 0 ? `
      <!-- Issues Summary Table -->
      <div class="issues-summary">
        <div class="issues-summary-header">
          <span class="issues-summary-title">${
            rankedIssues.length > TOP_ISSUES
              ? `Fix these first — top ${TOP_ISSUES} of ${rankedIssues.length}`
              : `Issues to fix (${rankedIssues.length})`
          }</span>
        </div>
        <table class="issues-table">
          <thead>
            <tr>
              <th>Issue</th>
              ${isMultiPageReport ? '<th>Page</th>' : ''}
              <th>Severity</th>
            </tr>
          </thead>
          <tbody>
            ${issueTableRows}
          </tbody>
        </table>
      </div>
      ` : ''}

      <!-- Filter Tabs -->
      <div class="filter-bar">
        <div class="filter-tabs">
          <button class="filter-tab active" data-filter="all">
            All <span class="filter-tab-count">${totalChecks}</span>
          </button>
          <button class="filter-tab" data-filter="fail">
            Failures <span class="filter-tab-count">${failures.length}</span>
          </button>
          <button class="filter-tab" data-filter="warn">
            Warnings <span class="filter-tab-count">${warnings.length}</span>
          </button>
          <button class="filter-tab" data-filter="pass">
            Passed <span class="filter-tab-count">${passes.length}</span>
          </button>
          ${notMeasured.length > 0 ? `
          <button class="filter-tab" data-filter="notmeasured">
            Not measured <span class="filter-tab-count">${notMeasured.length}</span>
          </button>
          ` : ''}
        </div>
      </div>

      <!-- Category Scores -->
      <!--
        This sat inside the score card, where its 442px pushed the first
        finding to y=976 on a 900px screen: a report whose whole job is to say
        what to fix opened with nothing to fix in view. Scores are orientation,
        findings are the work, so the findings go first.
      -->
          <!-- Category Progress Bars -->
      <div class="category-progress-section">
        <div class="category-progress-title">Category Scores</div>
        <div class="category-progress-list">
          ${result.categoryResults.map(cat => {
            const category = getCategoryById(cat.categoryId);
            const catName = category?.name ?? cat.categoryId;
            const catColor = getScoreColor(cat.score);
            return `
            <a href="#category-${cat.categoryId}" class="category-progress-item">
              <span class="category-progress-name">${escapeHtml(catName)}</span>
              <div class="category-progress-bar">
                <div class="category-progress-fill" style="width: ${cat.score}%; background: ${catColor};"></div>
              </div>
              <span class="category-progress-value" style="color: ${catColor};">${cat.score}%</span>
            </a>
            `;
          }).join('')}
        </div>

      </div>

      <!-- Category Sections -->
      ${categorySectionsHtml}

      <!-- Footer -->
      <footer class="footer">
        <div class="footer-primary">
          <a href="https://www.npmjs.com/package/@seomator/seo-audit" target="_blank" rel="noopener">SEO Audit Open Source</a>
          &bull; ${result.categoryResults.length} categories &bull; ${totalChecks} checks
        </div>
        <div class="footer-secondary">
          For more free SEO tools, visit
          <a href="${SEOMATOR_TOOL_URL}" target="_blank" rel="noopener">seomator.com/free-seo-audit-tool</a>
        </div>
      </footer>
    </div>
  </main>

  <script>${generateScript(uniqueUrls)}</script>
</body>
</html>`;
}

/**
 * Write HTML report to a file
 * @param result - Audit result
 * @param filePath - Output file path
 */
export async function writeHtmlReport(result: AuditResult, filePath: string): Promise<void> {
  const fs = await import('fs');
  const html = renderHtmlReport(result);
  fs.writeFileSync(filePath, html, 'utf-8');
}
