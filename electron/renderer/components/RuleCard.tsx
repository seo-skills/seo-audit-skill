/**
 * Individual rule result card — mirrors the HTML report's rule-card design.
 *
 * Shows: status icon, rule name + ID, description, message, page URL badge,
 * inline "How to Fix" (for warn/fail), and expandable affected-items details.
 */

import { useState } from 'react';
import type { RuleResult } from '../../../src/types.js';
import type { RuleMetadataIpc } from '../../shared/ipc-types.js';
import { formatRuleIdAsName, getStatusIcon, getStatusColorClass } from '../lib/format.js';
import { getFixSuggestion } from '../lib/fix-suggestions.js';

interface RuleCardProps {
  rule: RuleResult;
  metadata?: RuleMetadataIpc;
}

/** Keys to skip when rendering details (already shown elsewhere or internal) */
const SKIP_KEYS = new Set(['pageUrl', 'suggestion', 'recommendation', 'note']);

function formatItemForDisplay(item: unknown): string | null {
  if (typeof item === 'string') return item;
  if (typeof item !== 'object' || item === null) return String(item);

  const obj = item as Record<string, unknown>;
  const label = obj.src ?? obj.href ?? obj.url ?? obj.match ?? obj.text ?? obj.type;
  const extra: string[] = [];

  if (obj.reason) extra.push(String(obj.reason));
  if (obj.issue) extra.push(String(obj.issue));
  if (obj.alt) extra.push(`alt="${obj.alt}"`);
  if (obj.statusCode) extra.push(`${obj.statusCode}`);
  if (obj.redirectCount) extra.push(`${obj.redirectCount} redirects`);
  if (obj.size) extra.push(`${Math.round(Number(obj.size) / 1024)}KB`);
  if (obj.level) extra.push(`H${obj.level}`);
  if (obj.context) extra.push(String(obj.context));

  if (label) {
    return extra.length > 0 ? `${label} (${extra.join(', ')})` : String(label);
  }

  const pairs = Object.entries(obj)
    .filter(([, v]) => v != null && v !== '')
    .map(([k, v]) => `${k}: ${v}`)
    .slice(0, 3);
  return pairs.join(', ') || null;
}

/** Get short URL path for display (matches HTML report's getShortUrl) */
function getShortUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.pathname === '/' ? '/' : parsed.pathname;
  } catch {
    return url;
  }
}

/** Convert camelCase key to readable label */
function formatKey(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

export function RuleCard({ rule, metadata }: RuleCardProps) {
  const [showDetails, setShowDetails] = useState(false);
  const fixText = rule.status !== 'pass' ? getFixSuggestion(rule.ruleId) : null;
  const icon = getStatusIcon(rule.status);
  const colorClass = getStatusColorClass(rule.status);
  const details = rule.details ?? {};
  const pageUrl = details.pageUrl as string | undefined;
  const suggestion = (details.suggestion ?? details.recommendation ?? details.note) as string | undefined;

  // Rule name from metadata (main process registry) or fallback from ruleId
  const ruleName = metadata?.name ?? formatRuleIdAsName(rule.ruleId);
  // Rule description from metadata
  const ruleDescription = metadata?.description;
  // Only show description if it's different from the message
  const showDescription = ruleDescription && ruleDescription !== rule.message;

  // Separate detail fields into lists (arrays) and stats (scalars/objects)
  const listFields: { key: string; items: unknown[] }[] = [];
  const statFields: { key: string; value: unknown }[] = [];

  for (const [key, value] of Object.entries(details)) {
    if (SKIP_KEYS.has(key)) continue;
    if (Array.isArray(value) && value.length > 0) {
      listFields.push({ key, items: value });
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      const entries = Object.entries(value as Record<string, unknown>);
      if (entries.length > 0) {
        statFields.push({ key, value });
      }
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      statFields.push({ key, value });
    }
  }

  const hasExtraDetails = listFields.length > 0 || statFields.length > 0;

  return (
    <div
      className="border border-[var(--color-border-subtle)] rounded-lg p-4 hover:bg-[var(--color-bg-hover)] transition-colors"
      id={`rule-${rule.ruleId}`}
    >
      <div className="flex items-start gap-3">
        {/* Status icon */}
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 mt-0.5"
          style={{
            color: rule.status === 'pass' ? 'var(--color-pass)' : rule.status === 'warn' ? 'var(--color-warn)' : 'var(--color-fail)',
            backgroundColor: rule.status === 'pass' ? 'var(--color-pass-bg)' : rule.status === 'warn' ? 'var(--color-warn-bg)' : 'var(--color-fail-bg)',
          }}
        >
          {icon}
        </div>

        <div className="flex-1 min-w-0">
          {/* Title row: Rule name + Rule ID */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
              {ruleName}
            </span>
            <span
              className="text-[11px] font-mono px-1.5 py-0.5 rounded"
              style={{
                color: 'var(--color-text-muted)',
                backgroundColor: 'var(--color-bg)',
              }}
            >
              {rule.ruleId}
            </span>
          </div>

          {/* Rule description (what this rule checks) */}
          {showDescription && (
            <p className="text-xs mt-0.5 italic" style={{ color: 'var(--color-text-muted)' }}>
              {ruleDescription}
            </p>
          )}

          {/* Result message */}
          <p className="text-[13px] mt-1" style={{ color: 'var(--color-text-secondary)' }}>
            {rule.message}
          </p>

          {/* Page URL badge */}
          {pageUrl && (
            <div className="mt-1.5">
              <a
                href={pageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block text-xs font-mono px-2 py-0.5 rounded hover:opacity-80 transition-opacity"
                style={{
                  color: 'var(--color-accent)',
                  backgroundColor: 'var(--color-accent-light)',
                }}
              >
                {getShortUrl(pageUrl)}
              </a>
            </div>
          )}

          {/* Suggestion from details */}
          {suggestion && (
            <p className="text-xs mt-1.5 italic" style={{ color: 'var(--color-text-muted)' }}>
              {suggestion}
            </p>
          )}

          {/* How to Fix — shown inline for warn/fail, matches HTML report style */}
          {fixText && (
            <div
              className="mt-3 pl-3 py-2"
              style={{ borderLeft: '3px solid var(--color-accent)' }}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13" style={{ color: 'var(--color-accent)' }}>
                  <path d="M9 21h6M12 3a6 6 0 0 0-3 11.2V17h6v-2.8A6 6 0 0 0 12 3z"/>
                </svg>
                <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-accent)' }}>
                  How to Fix
                </span>
              </div>
              <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                {fixText}
              </p>
            </div>
          )}

          {/* Expandable details for affected items */}
          {hasExtraDetails && (
            <div className="mt-2">
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="text-xs font-medium hover:underline"
                style={{ color: 'var(--color-accent)' }}
              >
                {showDetails ? 'Hide details' : `View details (${listFields.reduce((n, f) => n + f.items.length, 0) + statFields.length} items)`}
              </button>

              {showDetails && (
                <div className="mt-2 space-y-2">
                  {/* Stat fields (counts, booleans, record objects) */}
                  {statFields.length > 0 && (
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      {statFields.map(({ key, value }) => {
                        if (typeof value === 'object' && value !== null) {
                          return Object.entries(value as Record<string, unknown>).map(([k, v]) => (
                            <span key={`${key}-${k}`} className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                              <span className="font-medium" style={{ color: 'var(--color-text-secondary)' }}>{k}:</span> {String(v)}
                            </span>
                          ));
                        }
                        return (
                          <span key={key} className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                            <span className="font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                              {formatKey(key)}:
                            </span>{' '}
                            {typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value)}
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {/* List fields (arrays of affected items) */}
                  {listFields.map(({ key, items }) => (
                    <div key={key}>
                      <div className="text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                        {formatKey(key)} ({items.length}{items.length >= 10 ? '+' : ''})
                      </div>
                      <div
                        className="rounded-md p-2 space-y-0.5 max-h-48 overflow-y-auto"
                        style={{ backgroundColor: 'var(--color-bg)' }}
                      >
                        {items.map((item, i) => {
                          const text = formatItemForDisplay(item);
                          if (!text) return null;
                          return (
                            <div
                              key={i}
                              className="text-xs font-mono truncate"
                              style={{ color: 'var(--color-text-secondary)' }}
                              title={text}
                            >
                              {text}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
