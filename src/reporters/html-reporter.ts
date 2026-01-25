import type { AuditResult, CategoryResult, RuleResult } from '../types.js';
import { getCategoryById } from '../categories/index.js';
import { getFixSuggestion } from './fix-suggestions.js';

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

      /* Accent */
      --color-accent: #6366f1;
      --color-accent-hover: #4f46e5;

      /* Shadows */
      --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
      --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1);
      --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1);

      /* Spacing & Layout */
      --header-height: 64px;
      --sidebar-width: 240px;
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

    /* Dark theme */
    [data-theme="dark"] {
      --color-bg: #0f172a;
      --color-bg-elevated: #1e293b;
      --color-bg-hover: #334155;
      --color-bg-active: #475569;
      --color-border: #334155;
      --color-border-subtle: #1e293b;
      --color-text: #f8fafc;
      --color-text-secondary: #cbd5e1;
      --color-text-muted: #64748b;

      --color-pass-bg: rgba(16, 185, 129, 0.15);
      --color-warn-bg: rgba(245, 158, 11, 0.15);
      --color-fail-bg: rgba(239, 68, 68, 0.15);
      --color-info-bg: rgba(59, 130, 246, 0.15);

      --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
      --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.4), 0 2px 4px -2px rgba(0, 0, 0, 0.3);
      --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.5), 0 4px 6px -4px rgba(0, 0, 0, 0.4);
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
      gap: 32px;
      background: var(--color-bg-elevated);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      padding: 24px;
      margin-bottom: 24px;
      box-shadow: var(--shadow-sm);
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

    .score-details {
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 16px;
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

    .issue-row-count {
      font-family: var(--font-mono);
      font-size: 13px;
      font-weight: 600;
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

    .rule-title {
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 4px;
    }

    .rule-id {
      font-family: var(--font-mono);
      font-size: 11px;
      color: var(--color-text-muted);
      margin-left: 8px;
      font-weight: 400;
    }

    .rule-message {
      font-size: 13px;
      color: var(--color-text-secondary);
      margin-bottom: 8px;
    }

    .rule-fix {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      padding: 10px 12px;
      background: var(--color-info-bg);
      border-radius: var(--radius-md);
      font-size: 12px;
      color: var(--color-info);
      margin-top: 12px;
    }

    .rule-fix-icon {
      flex-shrink: 0;
      margin-top: 1px;
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
      0% { background: var(--color-info-bg); }
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

      // Filter tabs
      const filterTabs = document.querySelectorAll('.filter-tab');
      const ruleCards = document.querySelectorAll('.rule-card');
      const categorySections = document.querySelectorAll('.category-section');

      filterTabs.forEach(tab => {
        tab.addEventListener('click', () => {
          // Update active tab
          filterTabs.forEach(t => t.classList.remove('active'));
          tab.classList.add('active');

          const filter = tab.dataset.filter;

          // Filter rule cards
          ruleCards.forEach(card => {
            if (filter === 'all') {
              card.classList.remove('hidden');
            } else {
              const status = card.dataset.status;
              card.classList.toggle('hidden', status !== filter);
            }
          });

          // Hide empty categories
          categorySections.forEach(section => {
            const visibleRules = section.querySelectorAll('.rule-card:not(.hidden)');
            section.style.display = visibleRules.length === 0 ? 'none' : 'block';
          });
        });
      });

      // Click-to-scroll from issues table
      const issueRows = document.querySelectorAll('.issue-row');
      issueRows.forEach(row => {
        row.addEventListener('click', () => {
          const ruleId = row.dataset.ruleId;
          const targetCard = document.querySelector('[data-rule-id="' + ruleId + '"]');
          if (targetCard) {
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

  // Collect all issues
  const allIssues: { category: string; categoryId: string; result: RuleResult }[] = [];

  for (const categoryResult of result.categoryResults) {
    const category = getCategoryById(categoryResult.categoryId);
    const categoryName = category?.name ?? categoryResult.categoryId;

    for (const ruleResult of categoryResult.results) {
      allIssues.push({
        category: categoryName,
        categoryId: categoryResult.categoryId,
        result: ruleResult
      });
    }
  }

  const failures = allIssues.filter(i => i.result.status === 'fail');
  const warnings = allIssues.filter(i => i.result.status === 'warn');
  const passes = allIssues.filter(i => i.result.status === 'pass');
  const totalChecks = allIssues.length;

  // Calculate circumference for score circle
  const radius = 58;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (result.overallScore / 100) * circumference;

  // Generate issues table rows (failures and warnings only)
  const issueTableRows = [...failures, ...warnings]
    .map(({ category, result: r }) => `
      <tr class="issue-row" data-rule-id="${escapeHtml(r.ruleId)}">
        <td>
          <div class="issue-row-name">
            <div class="issue-row-icon ${r.status}">${r.status === 'fail' ? '✕' : '!'}</div>
            <div>
              <div class="issue-row-text">${escapeHtml(r.ruleId)}</div>
              <div class="issue-row-category">${escapeHtml(category)}</div>
            </div>
          </div>
        </td>
        <td>
          <span class="issue-row-count">${r.status === 'fail' ? 'Critical' : 'Warning'}</span>
        </td>
      </tr>
    `).join('');

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

  // Generate category sections
  const categorySectionsHtml = result.categoryResults.map(cat => {
    const category = getCategoryById(cat.categoryId);
    const categoryName = category?.name ?? cat.categoryId;
    const categoryColor = getScoreColor(cat.score);

    const rulesHtml = cat.results.map(r => {
      const fix = getFixSuggestion(r.ruleId);
      const statusIcon = r.status === 'pass' ? '✓' : r.status === 'warn' ? '!' : '✕';

      const detailsHtml = r.details && Object.keys(r.details).length > 0
        ? `<div class="rule-details">
            ${Object.entries(r.details).map(([k, v]) => {
              const displayValue = typeof v === 'object'
                ? JSON.stringify(v)
                : String(v);
              const truncated = displayValue.length > 150
                ? displayValue.substring(0, 147) + '...'
                : displayValue;
              return `<div class="rule-detail-item">
                <span class="rule-detail-key">${escapeHtml(k)}:</span>
                <span class="rule-detail-value">${escapeHtml(truncated)}</span>
              </div>`;
            }).join('')}
          </div>`
        : '';

      const fixHtml = r.status !== 'pass'
        ? `<div class="rule-fix">
            <span class="rule-fix-icon">${getIcon('lightbulb')}</span>
            <span>${escapeHtml(fix)}</span>
          </div>`
        : '';

      return `
        <div class="rule-card" data-status="${r.status}" data-rule-id="${escapeHtml(r.ruleId)}">
          <div class="rule-header">
            <div class="rule-status-icon ${r.status}">${statusIcon}</div>
            <div class="rule-content">
              <div class="rule-title">
                ${escapeHtml(r.ruleId)}
                <span class="rule-id">${escapeHtml(r.ruleId)}</span>
              </div>
              <div class="rule-message">${escapeHtml(r.message)}</div>
              ${detailsHtml}
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
