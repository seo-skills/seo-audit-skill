import type { CategoryDefinition } from '../types.js';

/**
 * All category definitions for the SEO audit
 * Weights must sum to 100%
 *
 * Categories aligned with SquirrelScan structure:
 * - core: Meta tags, canonical, H1, indexing (merged from core-seo + meta-tags + headings)
 * - perf: Core Web Vitals + performance hints (merged from core-web-vitals + performance)
 * - schema: Structured data (renamed from structured-data)
 * - a11y: Accessibility (renamed from accessibility)
 * - crawl: Crawlability (renamed from crawlability)
 * - url: URL structure (renamed from url-structure)
 */
export const categories: CategoryDefinition[] = [
  {
    id: 'core',
    name: 'Core',
    description: 'Essential SEO: meta tags, canonical, H1, indexing directives, title uniqueness',
    weight: 14,
  },
  {
    id: 'technical',
    name: 'Technical SEO',
    description: 'Validates robots.txt, sitemap, SSL, and other technical aspects',
    weight: 8,
  },
  {
    id: 'perf',
    name: 'Performance',
    description: 'Core Web Vitals (LCP, CLS, INP, FCP, TTFB) and performance optimization hints',
    weight: 14,
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
    id: 'crawl',
    name: 'Crawlability',
    description: 'Validates indexability signals, sitemap-noindex conflicts, and canonical chains',
    weight: 6,
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
    weight: 5,
  },
  {
    id: 'content',
    name: 'Content',
    description: 'Analyzes text quality, readability, keyword density, heading structure',
    weight: 5,
  },
  {
    id: 'social',
    name: 'Social',
    description: 'Validates Open Graph, Twitter Cards, and social sharing metadata',
    weight: 4,
  },
  {
    id: 'eeat',
    name: 'E-E-A-T',
    description: 'Experience, Expertise, Authority, Trust signals for content quality',
    weight: 4,
  },
  {
    id: 'url',
    name: 'URL Structure',
    description: 'Analyzes URL formatting, keywords in slugs, and stop word usage',
    weight: 3,
  },
  {
    id: 'mobile',
    name: 'Mobile',
    description: 'Mobile-friendliness checks: font size, horizontal scroll, and interstitials',
    weight: 3,
  },
  {
    id: 'i18n',
    name: 'Internationalization',
    description: 'Checks language declarations and multi-region hreflang support',
    weight: 1,
  },
  {
    id: 'legal',
    name: 'Legal Compliance',
    description: 'Privacy policy and legal compliance signals: cookie consent',
    weight: 1,
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
