import type { CategoryDefinition } from '../types.js';

/**
 * All category definitions for the SEO audit
 * Weights must sum to 100%
 */
export const categories: CategoryDefinition[] = [
  {
    id: 'core-seo',
    name: 'Core SEO',
    description: 'Essential SEO checks: canonical validation, indexing directives, and title uniqueness',
    weight: 4,
  },
  {
    id: 'meta-tags',
    name: 'Meta Tags',
    description: 'Validates title, description, canonical, and other meta tags',
    weight: 10,
  },
  {
    id: 'headings',
    name: 'Headings',
    description: 'Checks heading structure and hierarchy (H1-H6)',
    weight: 6,
  },
  {
    id: 'technical',
    name: 'Technical SEO',
    description: 'Validates robots.txt, sitemap, SSL, and other technical aspects',
    weight: 10,
  },
  {
    id: 'core-web-vitals',
    name: 'Core Web Vitals',
    description: 'Measures LCP, FID, CLS, and other performance metrics',
    weight: 12,
  },
  {
    id: 'links',
    name: 'Links',
    description: 'Analyzes internal and external links, anchor text, and broken links',
    weight: 9,
  },
  {
    id: 'images',
    name: 'Images',
    description: 'Checks alt attributes, dimensions, lazy loading, and optimization',
    weight: 9,
  },
  {
    id: 'security',
    name: 'Security',
    description: 'Validates HTTPS, security headers, and mixed content',
    weight: 9,
  },
  {
    id: 'structured-data',
    name: 'Structured Data',
    description: 'Checks for valid JSON-LD, Schema.org markup, and rich snippets',
    weight: 6,
  },
  {
    id: 'social',
    name: 'Social',
    description: 'Validates Open Graph, Twitter Cards, and social sharing metadata',
    weight: 4,
  },
  {
    id: 'content',
    name: 'Content',
    description: 'Analyzes text quality, readability, keyword density, and content structure',
    weight: 5,
  },
  {
    id: 'accessibility',
    name: 'Accessibility',
    description: 'Checks for WCAG compliance, screen reader support, and keyboard navigation',
    weight: 6,
  },
  {
    id: 'i18n',
    name: 'Internationalization',
    description: 'Checks language declarations and multi-region hreflang support',
    weight: 2,
  },
  {
    id: 'performance',
    name: 'Performance',
    description: 'Static analysis for performance optimization (render-blocking, DOM size, fonts)',
    weight: 8,
  },
];

/**
 * Get a category definition by ID
 */
export function getCategoryById(id: string): CategoryDefinition | undefined {
  return categories.find((cat) => cat.id === id);
}

/**
 * Get all category IDs
 */
export function getCategoryIds(): string[] {
  return categories.map((cat) => cat.id);
}

/**
 * Validate that all category weights sum to 100
 */
export function validateCategoryWeights(): boolean {
  const totalWeight = categories.reduce((sum, cat) => sum + cat.weight, 0);
  return totalWeight === 100;
}
