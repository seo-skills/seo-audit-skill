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
    weight: 5,
  },
  {
    id: 'meta-tags',
    name: 'Meta Tags',
    description: 'Validates title, description, canonical, and other meta tags',
    weight: 12,
  },
  {
    id: 'headings',
    name: 'Headings',
    description: 'Checks heading structure and hierarchy (H1-H6)',
    weight: 9,
  },
  {
    id: 'technical',
    name: 'Technical SEO',
    description: 'Validates robots.txt, sitemap, SSL, and other technical aspects',
    weight: 12,
  },
  {
    id: 'core-web-vitals',
    name: 'Core Web Vitals',
    description: 'Measures LCP, FID, CLS, and other performance metrics',
    weight: 14,
  },
  {
    id: 'links',
    name: 'Links',
    description: 'Analyzes internal and external links, anchor text, and broken links',
    weight: 10,
  },
  {
    id: 'images',
    name: 'Images',
    description: 'Checks alt attributes, dimensions, lazy loading, and optimization',
    weight: 10,
  },
  {
    id: 'security',
    name: 'Security',
    description: 'Validates HTTPS, security headers, and mixed content',
    weight: 10,
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
    weight: 5,
  },
  {
    id: 'content',
    name: 'Content',
    description: 'Analyzes text quality, readability, keyword density, and content structure',
    weight: 7,
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
