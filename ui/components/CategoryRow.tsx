/**
 * The categories as a scrolling row, for screens too narrow for the sidebar.
 *
 * Same navigation, same scores, laid along the top instead of down the side —
 * a 240px rail beside the content is what pushed the detail page off a phone
 * screen entirely.
 */

import type { CategoryResult } from '../../src/types.js';
import { getScoreColor } from '../lib/format.js';

interface CategoryRowProps {
  categories: CategoryResult[];
  activeCategory?: string | null;
  onCategoryClick: (categoryId: string) => void;
}

const CATEGORY_NAMES: Record<string, string> = {
  core: 'Core', technical: 'Technical', perf: 'Performance', links: 'Links',
  images: 'Images', security: 'Security', crawl: 'Crawl', schema: 'Schema',
  a11y: 'Accessibility', content: 'Content', social: 'Social', eeat: 'E-E-A-T',
  url: 'URL', mobile: 'Mobile', i18n: 'i18n', legal: 'Legal',
  js: 'JS', redirect: 'Redirects', htmlval: 'HTML', geo: 'AI/GEO',
};

export function CategoryRow({ categories, activeCategory, onCategoryClick }: CategoryRowProps) {
  return (
    <nav
      // `w-full` with `overflow-x-auto` is what makes this scroll rather than
      // widen the page; a negative-margin bleed defeats the scroll container.
      className="lg:hidden w-full max-w-full flex gap-2 overflow-x-auto pb-2"
      aria-label="Categories"
    >
      {categories.map((category) => {
        const active = activeCategory === category.categoryId;
        const issues = category.failCount + category.warnCount;
        return (
          <button
            key={category.categoryId}
            type="button"
            onClick={() => onCategoryClick(category.categoryId)}
            aria-current={active ? 'true' : undefined}
            className="shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm transition-colors"
            style={{
              borderColor: active ? 'var(--color-accent)' : 'var(--color-border)',
              backgroundColor: active ? 'var(--color-accent-light)' : 'transparent',
              color: 'var(--color-text-secondary)',
            }}
          >
            <span>{CATEGORY_NAMES[category.categoryId] ?? category.categoryId}</span>
            {issues > 0 && (
              <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                {issues}
              </span>
            )}
            <span className="font-semibold tabular-nums" style={{ color: getScoreColor(category.score) }}>
              {category.score}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
