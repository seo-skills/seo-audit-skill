/**
 * CSS grid of CategoryBar components for all audited categories.
 */

import type { CategoryResult } from '../../../src/types.js';
import { CategoryBar } from './CategoryBar.js';

// Category display names (matches src/categories/index.ts)
const CATEGORY_NAMES: Record<string, string> = {
  core: 'Core SEO',
  technical: 'Technical SEO',
  perf: 'Performance',
  links: 'Links',
  images: 'Images',
  security: 'Security',
  crawl: 'Crawlability',
  schema: 'Structured Data',
  a11y: 'Accessibility',
  content: 'Content',
  social: 'Social',
  eeat: 'E-E-A-T',
  url: 'URL Structure',
  mobile: 'Mobile',
  i18n: 'Internationalization',
  legal: 'Legal',
  js: 'JS Rendering',
  redirect: 'Redirects',
  htmlval: 'HTML Validation',
  geo: 'AI/GEO',
};

interface CategoryGridProps {
  categories: CategoryResult[];
  activeCategory?: string | null;
  onCategoryClick?: (categoryId: string) => void;
}

export function CategoryGrid({ categories, activeCategory, onCategoryClick }: CategoryGridProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
      {categories.map((cat) => (
        <CategoryBar
          key={cat.categoryId}
          name={CATEGORY_NAMES[cat.categoryId] ?? cat.categoryId}
          score={cat.score}
          passCount={cat.passCount}
          warnCount={cat.warnCount}
          failCount={cat.failCount}
          active={activeCategory === cat.categoryId}
          onClick={() => onCategoryClick?.(cat.categoryId)}
        />
      ))}
    </div>
  );
}
