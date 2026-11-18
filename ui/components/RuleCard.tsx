/**
 * Individual rule result card — mirrors the HTML report's rule-card design.
 *
 * Shows: status shape, rule name + ID, description, message, page URL badge,
 * inline "How to Fix" (for warn/fail), and expandable affected-items details.
 */

import { useState } from 'react';
import type { RuleResult } from '../../src/types.js';
import type { RuleMetadata } from '../../electron/shared/ipc-types.js';
import { formatRuleIdAsName, safeHref } from '../lib/format.js';
import { StatusShape } from './Status.js';

const STATUS_WORDS = { pass: 'Passes', warn: 'Warning', fail: 'Fails', 'not-measured': 'Not measured' } as const;
import { getFixSuggestion } from '../lib/fix-suggestions.js';
import { ADVISORY_CHIP, NOT_MEASURED_REASONS, reasonOf } from '../lib/audit-state.js';

interface RuleCardProps {
  rule: RuleResult;
  metadata?: RuleMetadata;
  /** Show the page badge: only on a multi-page audit, where it says which page */
  showPage?: boolean;
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

export function RuleCard({ rule, metadata, showPage = false }: RuleCardProps) {
  const [showDetails, setShowDetails] = useState(false);
  // A fix only makes sense for a finding; a check that took no reading gets
  // its reason and the one thing to do about it instead
  const fixText =
    rule.status === 'warn' || rule.status === 'fail'
      ? // Fix text comes from the main-process registry metadata; the local
        // fix-suggestions map is the offline fallback only.
        (metadata?.fix ?? getFixSuggestion(rule.ruleId))
      : null;
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
      // A row inside its category's surface, not a box of its own: the same
      // white and the same hairlines as every other table on the report.
      className="px-4 py-3 border-t border-[var(--color-border)] first:border-t-0 hover:bg-[var(--color-bg-hover)] transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--color-accent)]"
      id={`rule-${rule.ruleId}`}
      // Not a tab stop, but focusable when the page jumps here from the issues
      // table. Without it the scroll moved the view and left focus behind in
      // the table, so the next Tab continued from the row the reader had left
      // and a screen reader announced nothing at all.
      tabIndex={-1}
    >
      <div className="flex items-start gap-3">
        {/* Status: the shape carries it, the word is for screen readers */}
        <span className="status flex-shrink-0 mt-[5px]">
          <StatusShape status={rule.advisory && rule.status !== 'not-measured' ? 'advisory' : rule.status} />
          <span className="sr-only">{STATUS_WORDS[rule.status]}</span>
        </span>

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
            {rule.advisory && (
              <span
                className="text-[11px] px-1.5 py-0.5 rounded border"
                style={{ color: 'var(--color-text-secondary)', borderColor: 'var(--color-border)' }}
              >
                {ADVISORY_CHIP}
              </span>
            )}
          </div>

          {/* Rule description (what this rule checks) */}
          {showDescription && (
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
              {ruleDescription}
            </p>
          )}

          {/* Result message */}
          <p className="text-[13px] mt-1" style={{ color: 'var(--color-text-secondary)' }}>
            {rule.message}
          </p>

          {rule.status === 'not-measured' && (
            <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
              Not measured: {NOT_MEASURED_REASONS[reasonOf(rule)].label}
              {NOT_MEASURED_REASONS[reasonOf(rule)].action && ` · ${NOT_MEASURED_REASONS[reasonOf(rule)].action}`}
            </p>
          )}

          {/* Page URL badge */}
          {pageUrl && showPage && (
            <div className="mt-1.5">
              <a
                href={safeHref(pageUrl)}
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
            <p className="text-xs mt-1.5" style={{ color: 'var(--color-text-muted)' }}>
              {suggestion}
            </p>
          )}

          {/* How to fix, for a warning or a failure: a label, not a coloured stripe */}
          {fixText && (
            <div className="mt-2.5">
              <div className="label">How to fix</div>
              <p className="text-[13px] mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
                {fixText}
              </p>
            </div>
          )}

          {/* Expandable details for affected items */}
          {hasExtraDetails && (
            <div className="mt-2">
              {/* A real control, so it reads as one: it opens what the check found */}
              <button
                type="button"
                onClick={() => setShowDetails(!showDetails)}
                aria-expanded={showDetails}
                className="btn btn-ghost h-7 px-2 -ml-2 text-[13px]"
              >
                <svg viewBox="0 0 10 10" width="10" height="10" aria-hidden="true" style={{ transform: showDetails ? 'rotate(90deg)' : undefined, transition: 'transform 160ms ease' }}>
                  <path d="M3.5 2l3 3-3 3" fill="none" stroke="currentColor" strokeWidth="1.4" />
                </svg>
                {showDetails ? 'Hide details' : (() => {
                  const n = listFields.reduce((sum, f) => sum + f.items.length, 0) + statFields.length;
                  return `Details · ${n} ${n === 1 ? 'item' : 'items'}`;
                })()}
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
