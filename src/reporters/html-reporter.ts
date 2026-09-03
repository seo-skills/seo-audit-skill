import type { PageSnapshot, AuditResult, CategoryResult, RuleResult } from '../types.js';
import { scoreToVerdict, verdictStyle } from '../verdict.js';
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
          pageCount: 0
        });
      }

      const group = ruleGroups.get(key)!;
      if (url) {
        group.pages.push({ url, details: r.details || {} });
      }
      group.pageCount++;
    }

    aggregatedByCategory.set(cat.categoryId, Array.from(ruleGroups.values()));
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
      padding: 16px 20px;
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
      padding: 12px 16px;
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
      padding: 14px 16px;
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
      padding: 16px 20px;
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
      padding: 16px 20px;
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

    .rule-fix {
      margin-top: 12px;
      padding: 12px 16px;
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
      .sidebar {
        display: none;
      }
      .main {
        margin-left: 0;
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
 * Generate JavaScript for interactivity
 */
function generateScript(): string {
  return `
    (function() {
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
          // Support both single url and multiple urls (comma-separated)
          const urls = (card.dataset.urls || card.dataset.url || '').split(',').filter(Boolean);

          const statusMatch = currentStatusFilter === 'all' || status === currentStatusFilter;
          const urlMatch = currentUrlFilter === 'all' || urls.length === 0 || urls.some(u => u.includes(currentUrlFilter));

          card.classList.toggle('hidden', !(statusMatch && urlMatch));
        });

        // Filter issue rows in summary table - supports multiple URLs
        issueRows.forEach(row => {
          const status = row.dataset.status;
          const urls = (row.dataset.urls || row.dataset.url || '').split(',').filter(Boolean);

          const statusMatch = currentStatusFilter === 'all' || status === currentStatusFilter;
          const urlMatch = currentUrlFilter === 'all' || urls.length === 0 || urls.some(u => u.includes(currentUrlFilter));

          row.classList.toggle('hidden', !(statusMatch && urlMatch));
        });

        // Hide empty categories
        categorySections.forEach(section => {
          const visibleRules = section.querySelectorAll('.rule-card:not(.hidden)');
          section.style.display = visibleRules.length === 0 ? 'none' : 'block';
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
          const urls = (card.dataset.urls || card.dataset.url || '').split(',').filter(Boolean);
          const urlMatch = currentUrlFilter === 'all' || urls.length === 0 || urls.some(u => u.includes(currentUrlFilter));

          if (urlMatch) {
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
 * The mark keeps its brand blue and white arc; the lettering inherits
 * `currentColor`. The source file left that path unfilled, which defaults to
 * black and would have rendered the name invisible against the dark theme.
 *
 * Mark plus lettering, roughly 5:1, so it is sized by height and left to find
 * its own width.
 */
/** Where the header lockup and the footer send readers for the hosted tool. */
const SEOMATOR_TOOL_URL = 'https://seomator.com/free-seo-audit-tool';

const SEOMATOR_WORDMARK =
  '<svg viewBox="0 0 1047.992 203" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="SEOmator"><g transform="translate(0 -2)" fill="currentColor"><circle cx="101.5" cy="101.5" r="101.5" transform="translate(0 2)" fill="#064ada"/><path d="M64.1,75.1a57.1,57.1,0,0,0,57.1-57.1H7A57.1,57.1,0,0,0,64.1,75.1Z" transform="translate(37.409 85.505)" fill="#fff"/><path d="M40.112,2.392q-24.1,0-39.744-16.744L17.112-29.624Q27.6-17.848,39.56-17.848q6.44,0,9.844-2.852a8.882,8.882,0,0,0,3.4-7.084,7.925,7.925,0,0,0-1.2-4.416q-1.2-1.84-4.968-3.5a64.2,64.2,0,0,0-11.316-3.312q-12.88-3.128-19.136-7.728t-8.28-10.3A34.959,34.959,0,0,1,5.888-68.816,26.725,26.725,0,0,1,15.364-89.7q9.476-8.372,26.22-8.372,11.592,0,19.872,3.5T77.1-81.512l-18.032,13.8a22.427,22.427,0,0,0-7.82-7.912,18.546,18.546,0,0,0-9.108-2.392,16.513,16.513,0,0,0-8.556,2.024,6.937,6.937,0,0,0-3.4,6.44,6.813,6.813,0,0,0,2.208,4.692q2.208,2.3,10.672,4.508,13.984,3.5,21.344,8.188t10.12,10.58A30.4,30.4,0,0,1,77.28-28.52,27,27,0,0,1,72.4-12.7,33.591,33.591,0,0,1,59.156-1.656,43.209,43.209,0,0,1,40.112,2.392Zm90.9,0q-14.72,0-25.944-6.808A47.419,47.419,0,0,1,87.676-22.54a51.639,51.639,0,0,1-6.164-25.116,50.9,50.9,0,0,1,6.44-25.3,49.363,49.363,0,0,1,17.572-18.308,47.855,47.855,0,0,1,25.484-6.808,46.911,46.911,0,0,1,25.3,6.808A47.71,47.71,0,0,1,173.42-72.956a52.7,52.7,0,0,1,6.164,25.3q0,2.024-.184,4.232t-.552,4.6H107.272a25.6,25.6,0,0,0,8.188,13.8q6.164,5.336,15.548,5.336a26.318,26.318,0,0,0,14.076-3.68,27.229,27.229,0,0,0,9.292-9.2L173.7-18.032q-5.7,9.016-17.112,14.72A56.393,56.393,0,0,1,131.008,2.392Zm-.368-79.12a22.471,22.471,0,0,0-15.088,5.336,25.436,25.436,0,0,0-8.28,13.984H154.56a27,27,0,0,0-8.372-13.616A22.423,22.423,0,0,0,130.64-76.728ZM234.6,2.392a50.976,50.976,0,0,1-26.312-6.808A49.394,49.394,0,0,1,190.164-22.54a49.332,49.332,0,0,1-6.532-25.116,49.831,49.831,0,0,1,6.532-25.208A49.18,49.18,0,0,1,208.288-91.08,50.976,50.976,0,0,1,234.6-97.888,50.842,50.842,0,0,1,261-91.08a49.389,49.389,0,0,1,18.032,18.216,49.832,49.832,0,0,1,6.532,25.208,49.332,49.332,0,0,1-6.532,25.116A49.6,49.6,0,0,1,261-4.416,50.842,50.842,0,0,1,234.6,2.392Zm0-22.632a25.023,25.023,0,0,0,13.8-3.772,25.629,25.629,0,0,0,9.108-10.028,29.313,29.313,0,0,0,3.22-13.616,29.7,29.7,0,0,0-3.22-13.8A25.629,25.629,0,0,0,248.4-71.484a25.023,25.023,0,0,0-13.8-3.772,25.023,25.023,0,0,0-13.8,3.772,25.629,25.629,0,0,0-9.108,10.028,29.7,29.7,0,0,0-3.22,13.8,29.313,29.313,0,0,0,3.22,13.616A25.629,25.629,0,0,0,220.8-24.012,25.023,25.023,0,0,0,234.6-20.24ZM294.768,0V-95.68H319.24V-81.7q7.544-16.192,29.256-16.192A35.66,35.66,0,0,1,366.712-93.2a34.145,34.145,0,0,1,12.88,13.34A35.856,35.856,0,0,1,391.828-93.2q7.452-4.692,20.148-4.692A36.468,36.468,0,0,1,430.56-93.1a34.092,34.092,0,0,1,13.064,13.616q4.784,8.832,4.784,20.976V0h-24.84V-52.44q0-12.512-5.336-18.124a18.188,18.188,0,0,0-13.8-5.612q-8.648,0-14.076,4.968T384.928-52.44V0h-24.84V-52.44q0-12.512-5.7-18.124t-14.9-5.612a19.676,19.676,0,0,0-13.892,5.612q-5.98,5.612-5.98,18.124V0ZM503.976,2.392a44.116,44.116,0,0,1-23.828-6.716,49.3,49.3,0,0,1-17.112-18.032,50.447,50.447,0,0,1-6.348-25.116,51.323,51.323,0,0,1,3.68-19.412,51.486,51.486,0,0,1,10.12-16.008,47.719,47.719,0,0,1,15-10.856A43.522,43.522,0,0,1,503.976-97.7q12.512,0,19.5,4.692a31.8,31.8,0,0,1,10.856,12.42V-95.68h24.656V0h-24.1V-15.64A33,33,0,0,1,523.94-2.576Q516.856,2.392,503.976,2.392Zm4.048-22.448a26.174,26.174,0,0,0,14.26-3.772,26.092,26.092,0,0,0,9.292-10.028,28.653,28.653,0,0,0,3.312-13.616,29.032,29.032,0,0,0-3.312-13.8,26.788,26.788,0,0,0-9.292-10.12,25.7,25.7,0,0,0-14.26-3.864,25.483,25.483,0,0,0-13.892,3.772,26.092,26.092,0,0,0-9.292,10.028,29.032,29.032,0,0,0-3.312,13.8,28.821,28.821,0,0,0,3.312,13.524,26.6,26.6,0,0,0,9.292,10.212A25.027,25.027,0,0,0,508.024-20.056ZM608.12,0q-14.168,0-21.712-6.992t-7.544-22.632v-44.9H565.432V-95.68h13.432V-115l24.84-2.576v21.9h20.24v21.16H603.7v43.608q0,8.832,7.728,8.832h10.3V0ZM675.1,2.392a50.976,50.976,0,0,1-26.312-6.808A49.4,49.4,0,0,1,630.66-22.54a49.332,49.332,0,0,1-6.532-25.116,49.831,49.831,0,0,1,6.532-25.208A49.181,49.181,0,0,1,648.784-91.08,50.976,50.976,0,0,1,675.1-97.888a50.842,50.842,0,0,1,26.4,6.808,49.389,49.389,0,0,1,18.032,18.216,49.831,49.831,0,0,1,6.532,25.208,49.332,49.332,0,0,1-6.532,25.116A49.6,49.6,0,0,1,701.5-4.416,50.842,50.842,0,0,1,675.1,2.392Zm0-22.632a25.023,25.023,0,0,0,13.8-3.772A25.629,25.629,0,0,0,698-34.04a29.313,29.313,0,0,0,3.22-13.616,29.7,29.7,0,0,0-3.22-13.8A25.629,25.629,0,0,0,688.9-71.484a25.023,25.023,0,0,0-13.8-3.772,25.023,25.023,0,0,0-13.8,3.772,25.629,25.629,0,0,0-9.108,10.028,29.7,29.7,0,0,0-3.22,13.8,29.313,29.313,0,0,0,3.22,13.616A25.629,25.629,0,0,0,661.3-24.012,25.023,25.023,0,0,0,675.1-20.24ZM735.264,0V-95.68h24.1v18.216q2.392-10.3,9.752-15.732t19.872-4.692V-74.52h-3.5a25.574,25.574,0,0,0-18.032,6.808Q760.1-60.9,760.1-48.944V0Z" transform="translate(259 160)"/></g></svg>';

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
  const uniqueUrls = Array.from(allUrls).sort();

  // Drives every per-rule page link. Read from the URLs the rules actually
  // reported rather than from `crawledPages`, so a crawl that resolved to one
  // page is treated as the single-page report it is.
  const isMultiPageReport = uniqueUrls.length > 1;

  // Calculate circumference for score circle
  const radius = 58;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (result.overallScore / 100) * circumference;

  // Generate issues table rows (failures and warnings only) - now using aggregated data
  const issueTableRows = [...failures, ...warnings]
    .map((issue) => {
      const urlsCommaSeparated = issue.pages.map(p => p.url).join(',');
      const pageDisplay = issue.pages.length === 0
        ? '-'
        : issue.pages.length === 1
          ? `<span class="issue-row-url" title="${escapeHtml(issue.pages[0].url)}">${escapeHtml(getShortUrl(issue.pages[0].url))}</span>`
          : `<span class="issue-row-url">${issue.pages.length} pages</span>`;

      return `
      <tr class="issue-row" data-rule-id="${escapeHtml(issue.ruleId)}" data-status="${issue.status}" data-urls="${escapeHtml(urlsCommaSeparated)}">
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
  const urlFilterOptions = uniqueUrls.length > 1
    ? `<option value="all">All Pages (${uniqueUrls.length})</option>
       ${uniqueUrls.map(url => `<option value="${escapeHtml(url)}">${escapeHtml(getShortUrl(url))}</option>`).join('')}`
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

    // For 4+ pages, use collapsible list
    return `
      <details class="pages-toggle">
        <summary>${pages.length} pages affected</summary>
        <div class="pages-list">
          ${pages.map(p => `<a href="${escapeHtml(p.url)}" target="_blank" rel="noopener">${escapeHtml(getShortUrl(p.url))}</a>`).join('')}
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

    const rulesHtml = aggregatedIssues.map(issue => {
      const fix = getFixSuggestion(issue.ruleId);
      const statusIcon = STATUS_ICONS[issue.status];
      const urlsCommaSeparated = issue.pages.map(p => p.url).join(',');

      // Generate pages list HTML (collapsible for 4+ pages)
      const pagesHtml = generatePagesListHtml(issue.pages);

      // Show description only if we have one and it's not just the message repeated
      const showDescription = issue.ruleDescription && issue.ruleDescription !== issue.message;

      // Fix advice belongs to results that found something wrong. Offering it
      // for a check that took no reading told readers to optimise a metric
      // nobody had measured.
      const fixHtml = issue.status === 'fail' || issue.status === 'warn'
        ? `<div class="rule-fix">
            <div class="rule-fix-header">
              ${getIcon('lightbulb')}
              <span>How to Fix</span>
            </div>
            <div class="rule-fix-text">${escapeHtml(fix)}</div>
          </div>`
        : '';

      return `
        <div class="rule-card" data-status="${issue.status}" data-rule-id="${escapeHtml(issue.ruleId)}" data-urls="${escapeHtml(urlsCommaSeparated)}">
          <div class="rule-header">
            <div class="rule-status-icon ${issue.status}">${statusIcon}</div>
            <div class="rule-content">
              <div class="rule-title-row">
                <span class="rule-title">${escapeHtml(issue.ruleName)}</span>
                <span class="rule-id">${escapeHtml(issue.ruleId)}</span>
              </div>
              ${issue.status === 'notmeasured' ? '<div class="rule-notmeasured-tag">Not measured</div>' : ''}
              <div class="rule-message">${escapeHtml(issue.message)}</div>
              ${showDescription ? `<div class="rule-description">${escapeHtml(issue.ruleDescription)}</div>` : ''}
              ${pagesHtml}
              ${fixHtml}
            </div>
          </div>
        </div>
      `;
    }).join('');

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
            ? `${result.crawledPages} pages`
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
    ${uniqueUrls.length > 1 ? `
    <div class="url-filter">
      <label class="url-filter-label">Filter by Page</label>
      <select id="url-filter" class="url-filter-select">
        ${urlFilterOptions}
      </select>
    </div>
    ` : ''}
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
        </div>
      </div>

      <!-- Page Snapshot -->
      ${renderPageSnapshot(result.page, result.url)}

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

      ${failures.length + warnings.length > 0 ? `
      <!-- Issues Summary Table -->
      <div class="issues-summary">
        <div class="issues-summary-header">
          <span class="issues-summary-title">Issues to Fix (${failures.length + warnings.length})</span>
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

  <script>${generateScript()}</script>
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
