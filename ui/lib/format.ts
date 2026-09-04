/**
 * Formatting utilities extracted from src/reporters/html-reporter.ts
 * Used across all dashboard components for consistent score display.
 */

export function getScoreColor(score: number): string {
  if (score >= 90) return 'var(--color-pass)';
  if (score >= 70) return 'var(--color-warn)';
  if (score >= 50) return 'var(--color-orange)';
  return 'var(--color-fail)';
}

export function getScoreColorClass(score: number): string {
  if (score >= 90) return 'text-pass';
  if (score >= 70) return 'text-warn';
  if (score >= 50) return 'text-[var(--color-orange)]';
  return 'text-fail';
}

export function getScoreBgClass(score: number): string {
  if (score >= 90) return 'bg-pass-bg';
  if (score >= 70) return 'bg-warn-bg';
  if (score >= 50) return 'bg-[var(--color-warn-bg)]';
  return 'bg-fail-bg';
}

export function getScoreLabel(score: number): string {
  if (score >= 90) return 'Excellent';
  if (score >= 70) return 'Good';
  if (score >= 50) return 'Needs Work';
  return 'Poor';
}

export function formatRuleIdAsName(ruleId: string): string {
  return ruleId
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function getStatusIcon(status: 'pass' | 'warn' | 'fail'): string {
  switch (status) {
    case 'pass': return '\u2713';
    case 'warn': return '!';
    case 'fail': return '\u2717';
  }
}

export function getStatusColorClass(status: 'pass' | 'warn' | 'fail'): string {
  switch (status) {
    case 'pass': return 'text-pass';
    case 'warn': return 'text-warn';
    case 'fail': return 'text-fail';
  }
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
