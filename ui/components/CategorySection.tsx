/**
 * Collapsible section for a single category's rule results.
 */

import { useState } from 'react';
import type { CategoryResult } from '../../src/types.js';
import type { RuleMetadata } from '../../electron/shared/ipc-types.js';
import { getScoreColor, verdictStyle } from '../lib/format.js';
import { RuleCard } from './RuleCard.js';
import type { FilterStatus } from './FilterTabs.js';

// Category names (same as CategoryGrid)
const CATEGORY_NAMES: Record<string, string> = {
  core: 'Core SEO', technical: 'Technical SEO', perf: 'Performance',
  links: 'Links', images: 'Images', security: 'Security',
  crawl: 'Crawlability', schema: 'Structured Data', a11y: 'Accessibility',
  content: 'Content', social: 'Social', eeat: 'E-E-A-T',
  url: 'URL Structure', mobile: 'Mobile', i18n: 'Internationalization',
  legal: 'Legal', js: 'JS Rendering', redirect: 'Redirects',
  htmlval: 'HTML Validation', geo: 'AI/GEO',
};

interface CategorySectionProps {
  category: CategoryResult;
  filter: FilterStatus;
  ruleMetadata?: Record<string, RuleMetadata>;
  defaultExpanded?: boolean;
}

export function CategorySection({ category, filter, ruleMetadata, defaultExpanded = false }: CategorySectionProps) {
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
  const expanded = override ?? defaultExpanded;
  const setExpanded = (next: boolean): void => setOverride(next);
  const color = getScoreColor(category.score);
  const name = CATEGORY_NAMES[category.categoryId] ?? category.categoryId;

  const filteredRules =
    filter === 'all'
      ? category.results
      : category.results.filter((r) => r.status === filter);

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
    <section id={`category-${category.categoryId}`} className="mb-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-[var(--color-bg-hover)] transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {expanded ? '\u25BC' : '\u25B6'}
          </span>
          <span className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
            {name}
          </span>
          <span
            className="text-xs px-2 py-0.5 rounded-full font-bold"
            style={verdictStyle(category.score)}
          >
            {Math.round(category.score)}
          </span>
        </div>
        <div className="flex gap-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
          {category.failCount > 0 && (
            <span style={{ color: 'var(--color-fail)' }}>{category.failCount} fail</span>
          )}
          {category.warnCount > 0 && (
            <span style={{ color: 'var(--color-warn)' }}>{category.warnCount} warn</span>
          )}
          <span style={{ color: 'var(--color-pass)' }}>{category.passCount} pass</span>
        </div>
      </button>

      {expanded && (
        <div className="ml-6 mt-1 space-y-2">
          {uniqueRules.map((rule) => (
            <RuleCard key={rule.ruleId} rule={rule} metadata={ruleMetadata?.[rule.ruleId]} />
          ))}
        </div>
      )}
    </section>
  );
}
