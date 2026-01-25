import type { AuditResult, CategoryResult, RuleResult } from '../types.js';
import { getCategoryById } from '../categories/index.js';

/**
 * Get color class for score
 */
function getScoreColor(score: number): string {
  if (score >= 90) return '#22c55e'; // green
  if (score >= 70) return '#eab308'; // yellow
  if (score >= 50) return '#f97316'; // orange
  return '#ef4444'; // red
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
 * Generate the HTML CSS styles
 */
function generateStyles(): string {
  return `
    :root {
      --color-pass: #22c55e;
      --color-warn: #eab308;
      --color-fail: #ef4444;
      --color-bg: #f8fafc;
      --color-card: #ffffff;
      --color-border: #e2e8f0;
      --color-text: #1e293b;
      --color-text-muted: #64748b;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      background: var(--color-bg);
      color: var(--color-text);
      line-height: 1.5;
      padding: 2rem;
    }

    .container {
      max-width: 1000px;
      margin: 0 auto;
    }

    .header {
      text-align: center;
      margin-bottom: 2rem;
    }

    .header h1 {
      font-size: 1.875rem;
      font-weight: 700;
      color: #0ea5e9;
      margin-bottom: 0.5rem;
    }

    .meta {
      color: var(--color-text-muted);
      font-size: 0.875rem;
    }

    .meta a {
      color: #0ea5e9;
      text-decoration: none;
    }

    .meta a:hover {
      text-decoration: underline;
    }

    .score-card {
      background: var(--color-card);
      border-radius: 1rem;
      padding: 2rem;
      text-align: center;
      margin-bottom: 2rem;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }

    .score-circle {
      width: 150px;
      height: 150px;
      border-radius: 50%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      margin: 0 auto 1rem;
      border: 8px solid;
    }

    .score-value {
      font-size: 3rem;
      font-weight: 700;
    }

    .score-label {
      font-size: 1rem;
      font-weight: 500;
    }

    .categories {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 1rem;
      margin-bottom: 2rem;
    }

    .category-card {
      background: var(--color-card);
      border-radius: 0.75rem;
      padding: 1.25rem;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }

    .category-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.75rem;
    }

    .category-name {
      font-weight: 600;
      font-size: 1rem;
    }

    .category-score {
      font-weight: 700;
      font-size: 1.125rem;
    }

    .category-stats {
      display: flex;
      gap: 1rem;
      font-size: 0.875rem;
      color: var(--color-text-muted);
    }

    .stat-pass { color: var(--color-pass); }
    .stat-warn { color: var(--color-warn); }
    .stat-fail { color: var(--color-fail); }

    .progress-bar {
      height: 6px;
      background: var(--color-border);
      border-radius: 3px;
      margin-top: 0.75rem;
      overflow: hidden;
    }

    .progress-fill {
      height: 100%;
      border-radius: 3px;
      transition: width 0.3s;
    }

    .issues-section {
      background: var(--color-card);
      border-radius: 0.75rem;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }

    .issues-header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 1rem;
      font-size: 1.125rem;
      font-weight: 600;
    }

    .issues-header.fail { color: var(--color-fail); }
    .issues-header.warn { color: var(--color-warn); }
    .issues-header.pass { color: var(--color-pass); }

    .issue-list {
      list-style: none;
    }

    .issue-item {
      padding: 1rem;
      border-bottom: 1px solid var(--color-border);
    }

    .issue-item:last-child {
      border-bottom: none;
    }

    .issue-title {
      font-weight: 600;
      margin-bottom: 0.25rem;
    }

    .issue-category {
      font-size: 0.75rem;
      color: var(--color-text-muted);
      margin-bottom: 0.5rem;
    }

    .issue-message {
      font-size: 0.875rem;
      color: var(--color-text);
    }

    .issue-details {
      margin-top: 0.5rem;
      font-size: 0.75rem;
      color: var(--color-text-muted);
      background: var(--color-bg);
      padding: 0.5rem;
      border-radius: 0.25rem;
    }

    .summary {
      background: var(--color-card);
      border-radius: 0.75rem;
      padding: 1.5rem;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }

    .summary h2 {
      font-size: 1.125rem;
      margin-bottom: 1rem;
    }

    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
      gap: 1rem;
    }

    .summary-item {
      text-align: center;
    }

    .summary-value {
      font-size: 1.5rem;
      font-weight: 700;
    }

    .summary-label {
      font-size: 0.75rem;
      color: var(--color-text-muted);
    }

    .footer {
      text-align: center;
      margin-top: 2rem;
      padding-top: 1rem;
      border-top: 1px solid var(--color-border);
      font-size: 0.75rem;
      color: var(--color-text-muted);
    }

    @media (max-width: 640px) {
      body {
        padding: 1rem;
      }

      .score-circle {
        width: 120px;
        height: 120px;
      }

      .score-value {
        font-size: 2.5rem;
      }

      .categories {
        grid-template-columns: 1fr;
      }
    }
  `;
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

  // Collect all issues
  const failures: { category: string; result: RuleResult }[] = [];
  const warnings: { category: string; result: RuleResult }[] = [];

  for (const categoryResult of result.categoryResults) {
    const category = getCategoryById(categoryResult.categoryId);
    const categoryName = category?.name ?? categoryResult.categoryId;

    for (const ruleResult of categoryResult.results) {
      if (ruleResult.status === 'fail') {
        failures.push({ category: categoryName, result: ruleResult });
      } else if (ruleResult.status === 'warn') {
        warnings.push({ category: categoryName, result: ruleResult });
      }
    }
  }

  const totalPassed = result.categoryResults.reduce((sum, cat) => sum + cat.passCount, 0);
  const totalChecks = totalPassed + warnings.length + failures.length;

  // Generate category cards
  const categoryCardsHtml = result.categoryResults.map(cat => {
    const category = getCategoryById(cat.categoryId);
    const categoryName = category?.name ?? cat.categoryId;
    const color = getScoreColor(cat.score);

    return `
      <div class="category-card">
        <div class="category-header">
          <span class="category-name">${escapeHtml(categoryName)}</span>
          <span class="category-score" style="color: ${color}">${cat.score}</span>
        </div>
        <div class="category-stats">
          <span class="stat-pass">${cat.passCount} passed</span>
          <span class="stat-warn">${cat.warnCount} warnings</span>
          <span class="stat-fail">${cat.failCount} failed</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${cat.score}%; background: ${color}"></div>
        </div>
      </div>
    `;
  }).join('');

  // Generate issue lists
  const failuresHtml = failures.length > 0 ? `
    <div class="issues-section">
      <div class="issues-header fail">
        <span>&#x2717;</span> Failures (${failures.length})
      </div>
      <ul class="issue-list">
        ${failures.map(({ category, result: r }) => `
          <li class="issue-item">
            <div class="issue-title">${escapeHtml(r.ruleId)}</div>
            <div class="issue-category">${escapeHtml(category)}</div>
            <div class="issue-message">${escapeHtml(r.message)}</div>
            ${r.details && Object.keys(r.details).length > 0 ? `
              <div class="issue-details">
                ${Object.entries(r.details).map(([k, v]) =>
                  `<div><strong>${escapeHtml(k)}:</strong> ${escapeHtml(String(v).slice(0, 100))}</div>`
                ).join('')}
              </div>
            ` : ''}
          </li>
        `).join('')}
      </ul>
    </div>
  ` : '';

  const warningsHtml = warnings.length > 0 ? `
    <div class="issues-section">
      <div class="issues-header warn">
        <span>&#x26A0;</span> Warnings (${warnings.length})
      </div>
      <ul class="issue-list">
        ${warnings.map(({ category, result: r }) => `
          <li class="issue-item">
            <div class="issue-title">${escapeHtml(r.ruleId)}</div>
            <div class="issue-category">${escapeHtml(category)}</div>
            <div class="issue-message">${escapeHtml(r.message)}</div>
            ${r.details && Object.keys(r.details).length > 0 ? `
              <div class="issue-details">
                ${Object.entries(r.details).map(([k, v]) =>
                  `<div><strong>${escapeHtml(k)}:</strong> ${escapeHtml(String(v).slice(0, 100))}</div>`
                ).join('')}
              </div>
            ` : ''}
          </li>
        `).join('')}
      </ul>
    </div>
  ` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SEO Audit Report - ${escapeHtml(result.url)}</title>
  <style>${generateStyles()}</style>
</head>
<body>
  <div class="container">
    <header class="header">
      <h1>SEO Audit Report</h1>
      <div class="meta">
        <a href="${escapeHtml(result.url)}" target="_blank">${escapeHtml(result.url)}</a>
        <br>
        ${timestamp}${result.crawledPages > 1 ? ` &bull; ${result.crawledPages} pages audited` : ''}
      </div>
    </header>

    <div class="score-card">
      <div class="score-circle" style="border-color: ${scoreColor}">
        <span class="score-value" style="color: ${scoreColor}">${result.overallScore}</span>
        <span class="score-label">${scoreLabel}</span>
      </div>
      <div style="color: var(--color-text-muted); font-size: 0.875rem;">
        ${result.overallScore >= 70 ? '&#x2713; Audit passed' : '&#x2717; Audit failed'} (threshold: 70)
      </div>
    </div>

    <div class="categories">
      ${categoryCardsHtml}
    </div>

    ${failuresHtml}
    ${warningsHtml}

    ${totalPassed > 0 ? `
    <div class="issues-section">
      <div class="issues-header pass">
        <span>&#x2713;</span> Passed (${totalPassed} checks)
      </div>
    </div>
    ` : ''}

    <div class="summary">
      <h2>Summary</h2>
      <div class="summary-grid">
        <div class="summary-item">
          <div class="summary-value">${totalChecks}</div>
          <div class="summary-label">Total Checks</div>
        </div>
        <div class="summary-item">
          <div class="summary-value stat-pass">${totalPassed}</div>
          <div class="summary-label">Passed</div>
        </div>
        <div class="summary-item">
          <div class="summary-value stat-warn">${warnings.length}</div>
          <div class="summary-label">Warnings</div>
        </div>
        <div class="summary-item">
          <div class="summary-value stat-fail">${failures.length}</div>
          <div class="summary-label">Failures</div>
        </div>
      </div>
    </div>

    <footer class="footer">
      Generated by SEOmator CLI &bull; <a href="https://www.npmjs.com/package/@seomator/seo-audit">@seomator/seo-audit</a>
    </footer>
  </div>
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
