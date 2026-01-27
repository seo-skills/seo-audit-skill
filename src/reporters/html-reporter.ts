import type { AuditResult, CategoryResult, RuleResult } from '../types.js';
import { getCategoryById } from '../categories/index.js';
import { getFixSuggestion } from './fix-suggestions.js';
import { getRuleById } from '../rules/registry.js';

/**
 * Rule metadata cache structure
 */
interface RuleMetadata {
  id: string;
  name: string;
  description: string;
}

/**
 * Aggregated issue structure for grouping same-rule occurrences
 */
interface AggregatedIssue {
  ruleId: string;
  status: 'fail' | 'warn' | 'pass';
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
      const key = `${r.ruleId}:${r.status}`;
      const url = extractUrlFromDetails(r.details);
      const metadata = ruleMetadataCache.get(r.ruleId);

      if (!ruleGroups.has(key)) {
        ruleGroups.set(key, {
          ruleId: r.ruleId,
          status: r.status,
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
 * Get color class for score
 */
function getScoreColor(score: number): string {
  if (score >= 90) return 'var(--color-pass)';
  if (score >= 70) return 'var(--color-warn)';
  if (score >= 50) return 'var(--color-orange)';
  return 'var(--color-fail)';
}

/**
 * Get score label
 */
function getScoreLabel(score: number): string {
  if (score >= 90) return 'Excellent';
  if (score >= 70) return 'Good';
  if (score >= 50) return 'Needs Work';
  return 'Poor';
}

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
 * Get short URL path for display
 */
function getShortUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.pathname === '/' ? '/' : parsed.pathname;
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
       CSS Custom Properties (Theme System)
       ======================================== */
    :root {
      /* Light theme (default) */
      --color-bg: #f8fafc;
      --color-bg-elevated: #ffffff;
      --color-bg-hover: #f1f5f9;
      --color-bg-active: #e2e8f0;
      --color-border: #e2e8f0;
      --color-border-subtle: #f1f5f9;
      --color-text: #0f172a;
      --color-text-secondary: #475569;
      --color-text-muted: #94a3b8;

      /* Status colors */
      --color-pass: #10b981;
      --color-pass-bg: #d1fae5;
      --color-warn: #f59e0b;
      --color-warn-bg: #fef3c7;
      --color-orange: #f97316;
      --color-fail: #ef4444;
      --color-fail-bg: #fee2e2;
      --color-info: #3b82f6;
      --color-info-bg: #dbeafe;

      /* Brand accent color */
      --color-accent: #064ada;
      --color-accent-hover: #0540b8;
      --color-accent-light: rgba(6, 74, 218, 0.1);

      /* Shadows */
      --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
      --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1);
      --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1);

      /* Spacing & Layout */
      --header-height: 64px;
      --sidebar-width: 260px;
      --content-max-width: 1200px;

      /* Typography */
      --font-sans: 'IBM Plex Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      --font-mono: 'IBM Plex Mono', 'SF Mono', Consolas, monospace;

      /* Border radius */
      --radius-sm: 4px;
      --radius-md: 8px;
      --radius-lg: 12px;
      --radius-full: 9999px;
    }

    /* Dark theme - True black */
    [data-theme="dark"] {
      --color-bg: #000000;
      --color-bg-elevated: #0a0a0a;
      --color-bg-hover: #161616;
      --color-bg-active: #1f1f1f;
      --color-border: #1a1a1a;
      --color-border-subtle: #111111;
      --color-text: #ffffff;
      --color-text-secondary: #a3a3a3;
      --color-text-muted: #525252;

      --color-pass-bg: rgba(16, 185, 129, 0.12);
      --color-warn-bg: rgba(245, 158, 11, 0.12);
      --color-fail-bg: rgba(239, 68, 68, 0.12);
      --color-info-bg: rgba(59, 130, 246, 0.12);
      --color-accent-light: rgba(6, 74, 218, 0.2);

      --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.5);
      --shadow-md: 0 4px 8px rgba(0, 0, 0, 0.6);
      --shadow-lg: 0 12px 24px rgba(0, 0, 0, 0.7);
    }

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
      gap: 12px;
      font-weight: 600;
      font-size: 16px;
      color: var(--color-text);
      text-decoration: none;
      flex-shrink: 0;
    }

    .header-brand svg {
      width: 28px;
      height: 28px;
      color: var(--color-accent);
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
    }

    .rule-url {
      font-family: var(--font-mono);
      font-size: 11px;
      color: var(--color-accent);
      background: var(--color-accent-light);
      padding: 2px 8px;
      border-radius: var(--radius-sm);
      text-decoration: none;
    }

    .rule-url:hover {
      text-decoration: underline;
    }

    .rule-message {
      font-size: 13px;
      color: var(--color-text-secondary);
      margin-bottom: 4px;
    }

    .rule-description {
      font-size: 12px;
      color: var(--color-text-muted);
      margin-bottom: 8px;
      font-style: italic;
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
      .score-overview {
        grid-template-columns: 1fr;
        gap: 20px;
      }
      .score-circle {
        margin: 0 auto;
      }
      .score-stats {
        justify-content: center;
      }
      .main {
        padding: 16px;
      }
      .issue-row-url {
        display: none;
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
          pass: 0
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
export function renderHtmlReport(result: AuditResult): string {
  const scoreColor = getScoreColor(result.overallScore);
  const scoreLabel = getScoreLabel(result.overallScore);
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
  const totalChecks = allAggregatedIssues.length;
  const uniqueUrls = Array.from(allUrls).sort();

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
            <div class="issue-row-icon ${issue.status}">${issue.status === 'fail' ? '✕' : '!'}</div>
            <div>
              <div class="issue-row-text">${escapeHtml(issue.ruleName)}</div>
              <div class="issue-row-category">${escapeHtml(issue.categoryName)}</div>
            </div>
          </div>
        </td>
        <td>
          ${pageDisplay}
        </td>
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
      const statusIcon = issue.status === 'pass' ? '✓' : issue.status === 'warn' ? '!' : '✕';
      const urlsCommaSeparated = issue.pages.map(p => p.url).join(',');

      // Generate pages list HTML (collapsible for 4+ pages)
      const pagesHtml = generatePagesListHtml(issue.pages);

      // Show description only if we have one and it's not just the message repeated
      const showDescription = issue.ruleDescription && issue.ruleDescription !== issue.message;

      // For passed rules, use collapsible details to reduce visual clutter
      const fixHtml = issue.status !== 'pass'
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
              ${showDescription ? `<div class="rule-description">${escapeHtml(issue.ruleDescription)}</div>` : ''}
              <div class="rule-message">${escapeHtml(issue.message)}</div>
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
            <span class="category-score" style="background: ${categoryColor}20; color: ${categoryColor}">${cat.score}/100</span>
          </div>
          <div class="category-stats">
            <span class="category-stat pass">${cat.passCount} passed</span>
            <span class="category-stat warn">${cat.warnCount} warnings</span>
            <span class="category-stat fail">${cat.failCount} failed</span>
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
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>${generateStyles()}</style>
</head>
<body>
  <!-- Fixed Header -->
  <header class="header">
    <a class="header-brand" href="#">
      ${getIcon('logo')}
      <span>SEO Audit</span>
    </a>
    <div class="header-url">
      <a href="${escapeHtml(result.url)}" target="_blank" rel="noopener">${escapeHtml(result.url)}</a>
    </div>
    <div class="header-meta">
      <div class="header-meta-item">
        ${getIcon('pages')}
        <span>${result.crawledPages} page${result.crawledPages !== 1 ? 's' : ''}</span>
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
              <th>Page</th>
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
        Generated by <a href="https://www.npmjs.com/package/@seomator/seo-audit" target="_blank" rel="noopener">SEOmator CLI</a> &bull; ${result.categoryResults.length} categories &bull; ${totalChecks} checks
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
