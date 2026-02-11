import type { CategoryDefinition } from '../types.js';

/**
 * All category definitions for the SEO audit
 * Weights must sum to 100%
 *
 * 20 categories, 256 rules total
 */
export const categories: CategoryDefinition[] = [
  {
    id: 'core',
    name: 'Core',
    description: 'Essential SEO: meta tags, canonical, H1, indexing directives, title uniqueness',
    weight: 12,
  },
  {
    id: 'technical',
    name: 'Technical SEO',
    description: 'Validates robots.txt, sitemap, SSL, status codes, and other technical aspects',
    weight: 7,
  },
  {
    id: 'perf',
    name: 'Performance',
    description: 'Core Web Vitals, compression, caching, minification, and performance optimization',
    weight: 12,
  },
  {
    id: 'links',
    name: 'Links',
    description: 'Analyzes internal and external links, anchor text, broken links, and link quality',
    weight: 8,
  },
  {
    id: 'images',
    name: 'Images',
    description: 'Checks alt attributes, dimensions, lazy loading, formats, and optimization',
    weight: 8,
  },
  {
    id: 'security',
    name: 'Security',
    description: 'Validates HTTPS, security headers, mixed content, and SSL configuration',
    weight: 8,
  },
  {
    id: 'crawl',
    name: 'Crawlability',
    description: 'Validates sitemap, pagination, indexability signals, and crawl configuration',
    weight: 5,
  },
  {
    id: 'schema',
    name: 'Structured Data',
    description: 'Checks for valid JSON-LD, Schema.org markup, and rich snippets',
    weight: 5,
  },
  {
    id: 'a11y',
    name: 'Accessibility',
    description: 'Checks for WCAG compliance, screen reader support, and keyboard navigation',
    weight: 4,
  },
  {
    id: 'content',
    name: 'Content',
    description: 'Analyzes text quality, readability, duplicate content, and heading structure',
    weight: 5,
  },
  {
    id: 'social',
    name: 'Social',
    description: 'Validates Open Graph, Twitter Cards, and social sharing metadata',
    weight: 3,
  },
  {
    id: 'eeat',
    name: 'E-E-A-T',
    description: 'Experience, Expertise, Authority, Trust signals for content quality',
    weight: 3,
  },
  {
    id: 'url',
    name: 'URL Structure',
    description: 'Analyzes URL formatting, length, parameters, session IDs, and slug quality',
    weight: 3,
  },
  {
    id: 'mobile',
    name: 'Mobile',
    description: 'Mobile-friendliness: font size, viewport, horizontal scroll, and interstitials',
    weight: 2,
  },
  {
    id: 'i18n',
    name: 'Internationalization',
    description: 'Language declarations, hreflang validation, and multi-region support',
    weight: 2,
  },
  {
    id: 'legal',
    name: 'Legal Compliance',
    description: 'Privacy policy and legal compliance signals: cookie consent',
    weight: 1,
  },
  {
    id: 'js',
    name: 'JavaScript Rendering',
    description: 'Checks JS-rendered content, SSR detection, and raw vs rendered DOM consistency',
    weight: 5,
  },
  {
    id: 'redirect',
    name: 'Redirects',
    description: 'Validates redirect types, chains, loops, meta refresh, and JS redirects',
    weight: 3,
  },
  {
    id: 'htmlval',
    name: 'HTML Validation',
    description: 'Validates HTML structure: DOCTYPE, charset, head integrity, and document size',
    weight: 2,
  },
  {
    id: 'geo',
    name: 'AI/GEO Readiness',
    description: 'Generative Engine Optimization: semantic HTML, content structure, AI bot access',
    weight: 2,
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
