/**
 * Fix suggestions for SEO audit rules
 *
 * Provides actionable, concise fix recommendations for each rule.
 * Used by the LLM reporter to include fixes in the output.
 */

export const FIX_SUGGESTIONS: Record<string, string> = {
  // ============ Core SEO ============
  'core-seo-canonical-header': 'Use HTML canonical only; reserve Link header for PDFs and non-HTML resources',
  'core-seo-nosnippet': 'Remove nosnippet directive unless intentionally blocking search snippets',
  'core-seo-robots-meta': 'Remove noindex/nofollow unless intentionally blocking search engines',
  'core-seo-title-unique': 'Create unique titles for each page: "Page Topic | Brand Name"',

  // ============ Meta Tags ============
  'meta-tags-title-present': 'Add <title> tag inside the <head> section',
  'meta-tags-title-length': 'Keep title between 30-60 characters for optimal search display',
  'meta-tags-description-present': 'Add <meta name="description" content="..."> with 120-160 characters',
  'meta-tags-description-length': 'Keep meta description between 120-160 characters',
  'meta-tags-canonical-present': 'Add <link rel="canonical" href="..."> to specify preferred URL',
  'meta-tags-canonical-valid': 'Ensure canonical URL is absolute, accessible, and returns 200 status',
  'meta-tags-viewport-present': 'Add <meta name="viewport" content="width=device-width, initial-scale=1">',
  'meta-tags-favicon-present': 'Add <link rel="icon" href="/favicon.ico"> or PNG/SVG favicon',

  // ============ Headings ============
  'headings-h1-present': 'Add a single H1 tag that describes the page main topic',
  'headings-h1-single': 'Use only one H1 per page; use H2-H6 for subsections',
  'headings-hierarchy': 'Maintain proper heading order (H1 → H2 → H3, no skipping levels)',
  'headings-content-length': 'Keep headings concise (under 70 characters) and descriptive',
  'headings-content-unique': 'Use unique headings that differ from page title and each other',
  'headings-lang-attribute': 'Add lang attribute to <html> tag: <html lang="en">',

  // ============ Technical SEO ============
  'technical-robots-txt-exists': 'Create robots.txt at site root with User-agent and sitemap directives',
  'technical-robots-txt-valid': 'Fix syntax errors in robots.txt; use standard directives only',
  'technical-sitemap-exists': 'Create XML sitemap at /sitemap.xml and reference in robots.txt',
  'technical-sitemap-valid': 'Fix sitemap XML errors; ensure all URLs are accessible',
  'technical-url-structure': 'Use clean URLs with hyphens, lowercase, and descriptive slugs',
  'technical-trailing-slash': 'Be consistent with trailing slashes; redirect duplicates',
  'technical-www-redirect': 'Choose www or non-www and redirect the other version',
  'technical-404-page': 'Create custom 404 page with navigation links and search',

  // ============ Core Web Vitals ============
  'cwv-lcp': 'Optimize LCP: preload hero images, use CDN, reduce server response time',
  'cwv-cls': 'Prevent CLS: set width/height on images and embeds, avoid dynamic content injection',
  'cwv-inp': 'Reduce INP: optimize JavaScript, break long tasks, use web workers',
  'cwv-fcp': 'Improve FCP: inline critical CSS, defer non-critical scripts, preload fonts',
  'cwv-ttfb': 'Lower TTFB: use CDN, enable caching, optimize database queries',

  // ============ Links ============
  'links-broken-internal': 'Fix or remove broken internal links (404 errors)',
  'links-external-valid': 'Remove or update broken external links',
  'links-internal-present': 'Add internal links to relevant pages for better navigation',
  'links-nofollow-appropriate': 'Use nofollow only for untrusted, sponsored, or user-generated links',
  'links-anchor-text': 'Use descriptive anchor text instead of "click here" or "read more"',
  'links-depth': 'Ensure important pages are within 3 clicks from homepage',
  'links-dead-end-pages': 'Add navigation links, related content, or breadcrumbs to avoid dead ends',
  'links-https-downgrade': 'Update HTTP links to HTTPS or remove insecure external links',
  'links-external-count': 'Reduce external links to essential, high-quality resources only',
  'links-invalid': 'Replace javascript: links with buttons, fix malformed URLs',
  'links-tel-mailto': 'Use E.164 format for phone (+1234567890), valid email for mailto',
  'links-redirect-chains': 'Update links to point directly to final destination URLs',
  'links-orphan-pages': 'Add internal links from other pages to improve discoverability',

  // ============ Images ============
  'images-alt-present': 'Add descriptive alt text to all images for accessibility and SEO',
  'images-alt-quality': 'Write meaningful alt text describing image content, not just keywords',
  'images-dimensions': 'Add width and height attributes to prevent layout shifts',
  'images-lazy-loading': 'Add loading="lazy" to below-fold images',
  'images-modern-format': 'Convert images to WebP or AVIF for better compression',
  'images-size': 'Compress images to reduce file size while maintaining quality',
  'images-responsive': 'Use srcset and sizes for responsive images on different devices',
  'images-broken': 'Fix or remove broken image references (404 errors)',
  'images-figure-captions': 'Add figcaption elements to describe figure content for accessibility',
  'images-filename-quality': 'Use descriptive filenames like "red-running-shoes.jpg" instead of "IMG_001.jpg"',
  'images-inline-svg-size': 'Move large SVGs (>5KB) to external files for better caching',
  'images-picture-element': 'Ensure every <picture> element contains an <img> fallback element',

  // ============ Security ============
  'security-https': 'Install SSL certificate and redirect all HTTP traffic to HTTPS',
  'security-https-redirect': 'Ensure HTTP to HTTPS redirect is in place',
  'security-hsts': 'Add Strict-Transport-Security header with max-age of at least 1 year',
  'security-csp': 'Implement Content-Security-Policy header to prevent XSS attacks',
  'security-x-frame-options': 'Add X-Frame-Options: DENY or SAMEORIGIN to prevent clickjacking',
  'security-x-content-type-options': 'Add X-Content-Type-Options: nosniff header',
  'security-external-links': 'Add rel="noopener noreferrer" to external target="_blank" links',
  'security-form-https': 'Update form actions to use HTTPS URLs',
  'security-mixed-content': 'Replace HTTP resource URLs with HTTPS or use protocol-relative URLs',
  'security-permissions-policy': 'Add Permissions-Policy header to control browser features',
  'security-referrer-policy': 'Add Referrer-Policy header (recommended: strict-origin-when-cross-origin)',
  'security-leaked-secrets': 'Remove exposed secrets immediately and rotate compromised credentials',

  // ============ Structured Data ============
  'structured-data-present': 'Add JSON-LD structured data for rich search results',
  'structured-data-valid': 'Fix JSON-LD syntax errors using Google Rich Results Test',
  'structured-data-type': 'Use appropriate schema type (Article, Product, LocalBusiness, etc.)',
  'structured-data-required-fields': 'Add required schema fields for the chosen type',
  'structured-data-article': 'Add Article schema with headline, author (Person/Organization), datePublished, and image',
  'structured-data-breadcrumb': 'Add BreadcrumbList schema with itemListElement array for navigation hierarchy',
  'structured-data-faq': 'Add FAQPage schema with mainEntity array of Question items with acceptedAnswer',
  'structured-data-local-business': 'Add LocalBusiness schema with name, address (PostalAddress), telephone, and geo coordinates',
  'structured-data-organization': 'Add Organization schema with name, logo, url, and sameAs for social profiles',
  'structured-data-product': 'Add Product schema with name, image, offers (price, priceCurrency, availability)',
  'structured-data-review': 'Add Review schema with itemReviewed, author, reviewRating; or AggregateRating with ratingValue, reviewCount',
  'structured-data-video': 'Add VideoObject schema with name, thumbnailUrl, uploadDate, and description',
  'structured-data-website-search': 'Add WebSite schema with potentialAction SearchAction for sitelinks searchbox',

  // ============ Social ============
  'social-og-title': 'Add <meta property="og:title" content="..."> for social sharing',
  'social-og-description': 'Add <meta property="og:description" content="..."> for social sharing',
  'social-og-image': 'Add <meta property="og:image" content="..."> with 1200x630px image',
  'social-og-url': 'Add <meta property="og:url" content="..."> matching canonical URL',
  'social-twitter-card': 'Add <meta name="twitter:card" content="summary_large_image">',

  // ============ Content ============
  'content-word-count': 'Expand thin content to at least 300 words for informational pages',
  'content-reading-level': 'Simplify text for broader audience; aim for 8th grade reading level',
  'content-keyword-stuffing': 'Write naturally; avoid repeating keywords excessively',
  'content-author-info': 'Add author byline with link to author bio page',
  'content-freshness': 'Update content regularly and display last modified date',
  'content-meta-in-body': 'Move all <meta> tags from <body> to <head> section',
  'content-mime-type': 'Ensure correct Content-Type header matches actual content',
  'content-broken-html': 'Fix HTML validation errors using W3C validator',
  'content-article-links': 'Add relevant internal and external links within article content',
  'content-duplicate-description': 'Use unique meta descriptions for each page',
};

/**
 * Get fix suggestion for a rule, with fallback
 */
export function getFixSuggestion(ruleId: string): string {
  return FIX_SUGGESTIONS[ruleId] || 'Review and fix this issue based on SEO best practices';
}
