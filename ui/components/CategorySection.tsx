/**
 * Collapsible section for a single category's rule results.
 */

import { useState } from 'react';
import type { CategoryResult } from '../../src/types.js';
import type { RuleMetadata } from '../../electron/shared/ipc-types.js';
import { getScoreColor } from '../lib/format.js';
import { CATEGORY_NAMES } from '../lib/fixes.js';
import { RuleCard } from './RuleCard.js';
import { Status } from './Status.js';
import { ScoreMeter } from './ScoreMeter.js';
import type { FilterStatus } from './FilterTabs.js';

interface CategorySectionProps {
  category: CategoryResult;
  filter: FilterStatus;
  ruleMetadata?: Record<string, RuleMetadata>;
  defaultExpanded?: boolean;
  /** Pages are named on each check only when the audit has more than one */
  multiPage?: boolean;
  /** "Expand all" / "Collapse all": applied once each time `nonce` changes */
  force?: { expanded: boolean; nonce: number };
}

export function CategorySection({ category, filter, ruleMetadata, defaultExpanded = false, multiPage = false, force }: CategorySectionProps) {
  // Expansion is derived, not copied.
  //
  // This was `useState(defaultExpanded)`, and `useState` reads its argument on
  // the first render only — so a section already on screen ignored every later
  // change to the prop, which is exactly how the issues table asks for the
  // category it is jumping to. Clicking an issue expanded nothing and the
  // drill-down silently did nothing.
  //
  // Syncing it in an effect fixes the expansion but not the jump: a passive
  // effect runs after the parent's layout effect, so the rule card still does
  // not exist at the moment the parent looks for it. Deriving during render
  // means the section is open in the same commit the parent acts on.
  //
  // `override` is the reader's own decision, and it wins until the parent asks
  // for this category again — a jump to a rule should not be defeated by a
  // section the reader collapsed ten minutes ago.
  const [override, setOverride] = useState<boolean | null>(null);
  const [lastRequested, setLastRequested] = useState(defaultExpanded);
  if (defaultExpanded !== lastRequested) {
    setLastRequested(defaultExpanded);
    if (defaultExpanded) setOverride(null);
  }
  // Expand all / Collapse all is an explicit request, so it sets the reader's
  // own choice for every section at once.
  const [lastForce, setLastForce] = useState(force?.nonce ?? 0);
  if (force && force.nonce !== lastForce) {
    setLastForce(force.nonce);
    setOverride(force.expanded);
  }
  const expanded = override ?? defaultExpanded;
  const setExpanded = (next: boolean): void => setOverride(next);
  const color = getScoreColor(category.score);
  const name = CATEGORY_NAMES[category.categoryId] ?? category.categoryId;

  const filteredRules =
    filter === 'all'
      ? category.results
      : category.results.filter((r) => r.status === (filter === 'notmeasured' ? 'not-measured' : filter));

  // Deduplicate rules by ruleId (keep worst status for multi-page audits)
  const uniqueRules = Array.from(
    filteredRules
      .reduce((map, rule) => {
        const existing = map.get(rule.ruleId);
        if (!existing || rule.score < existing.score) {
          map.set(rule.ruleId, rule);
        }
        return map;
      }, new Map<string, typeof filteredRules[0]>())
      .values(),
  );

  if (uniqueRules.length === 0) return null;

  return (
    <section id={`category-${category.categoryId}`} className="mb-2 border border-[var(--color-border)] bg-[var(--color-bg-elevated)] scroll-mt-[calc(var(--header-height)+64px)]">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-[var(--color-bg-hover)] transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--color-accent)]"
      >
        <span className="flex items-center gap-3 min-w-0">
          <svg viewBox="0 0 10 10" width="10" height="10" aria-hidden="true" className="shrink-0" style={{ transform: expanded ? 'rotate(90deg)' : undefined, transition: 'transform 160ms ease', color: 'var(--color-text-secondary)' }}>
            <path d="M3.5 2l3 3-3 3" fill="none" stroke="currentColor" strokeWidth="1.4" />
          </svg>
          <span className="text-sm font-semibold truncate" style={{ color: 'var(--color-text)' }}>
            {name}
          </span>
          <span className="figure text-[13px] w-6 text-right" style={{ color }}>
            {Math.round(category.score)}
          </span>
          <ScoreMeter value={category.score} score={Math.round(category.score)} label={`${name} score ${Math.round(category.score)}`} />
        </span>
        <span className="flex items-center gap-4 text-[13px] shrink-0">
          {category.failCount > 0 && <Status status="fail" word={`${category.failCount} fail`} />}
          {category.warnCount > 0 && <Status status="warn" word={`${category.warnCount} warn`} />}
          {/* Passing is not news: it stays quiet, so the eye goes to what is wrong */}
          <Status status="pass" word={`${category.passCount} pass`} />
        </span>
      </button>

      {expanded && (
        <div className="border-t border-[var(--color-border)]">
          {uniqueRules.map((rule) => (
            <RuleCard key={rule.ruleId} rule={rule} metadata={ruleMetadata?.[rule.ruleId]} showPage={multiPage} />
          ))}
        </div>
      )}
    </section>
  );
}
