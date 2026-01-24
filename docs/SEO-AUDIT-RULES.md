# SEO Audit Rules Reference

> Complete reference of all 109 SEO audit rules across 13 categories

## Overview

SEOmator audits websites using 109 rules organized into 13 categories. Each rule returns one of three statuses:
- **Pass** (score: 100) - Meets best practices
- **Warn** (score: 50) - Potential issue, should address
- **Fail** (score: 0) - Critical issue, must fix

---

## Categories & Weights

| Category | Weight | Rules | Description |
|----------|--------|-------|-------------|
| [Core SEO](#core-seo) | 4% | 4 | Essential SEO checks: canonical validation, indexing directives |
| [Meta Tags](#meta-tags) | 11% | 8 | Title, description, canonical, viewport, favicon |
| [Headings](#headings) | 7% | 5 | H1-H6 structure and hierarchy |
| [Technical SEO](#technical) | 11% | 8 | robots.txt, sitemap, URL structure |
| [Core Web Vitals](#core-web-vitals) | 13% | 5 | LCP, CLS, FCP, TTFB, INP |
| [Links](#links) | 10% | 13 | Internal/external links, anchor text, validation |
| [Images](#images) | 10% | 12 | Alt text, dimensions, lazy loading, broken images, accessibility |
| [Security](#security) | 10% | 12 | HTTPS, HSTS, CSP, security headers, leaked secrets |
| [Structured Data](#structured-data) | 6% | 13 | JSON-LD, Schema.org markup |
| [Social](#social) | 4% | 5 | Open Graph, Twitter Cards |
| [Content](#content) | 6% | 10 | Text quality, readability, keyword density |
| [Accessibility](#accessibility) | 6% | 12 | WCAG compliance, screen reader support, keyboard navigation |
| [Internationalization](#internationalization) | 2% | 2 | Language declarations, hreflang |

**Total: 100% weight, 109 rules**

---

## Core SEO

Essential SEO checks for canonical validation, indexing directives, and title uniqueness.

| Rule ID | Name | Severity | Description |
|---------|------|----------|-------------|
| `core-seo-canonical-header` | Canonical Header Validation | warn | Detects mismatch between HTML `<link rel="canonical">` and HTTP Link header |
| `core-seo-nosnippet` | Nosnippet Directive | warn | Detects pages preventing search engine snippets via nosnippet or max-snippet:0 |
| `core-seo-robots-meta` | Robots Meta | warn | Checks robots meta tag for noindex, nofollow, noarchive directives |
| `core-seo-title-unique` | Title Uniqueness | warn/fail | Checks that page titles are unique across the site (site-wide) |

### Rule Details

#### core-seo-canonical-header
- **What it checks:** Compares HTML `<link rel="canonical">` with HTTP Link header
- **Pass:** Neither exists, only one exists, or both match
- **Warn:** Both exist but specify different URLs
- **Fix:** Use HTML canonical tag exclusively; reserve Link header for non-HTML resources (PDFs)

#### core-seo-nosnippet
- **What it checks:** Detects directives that block search snippets
- **Detects:** `nosnippet`, `max-snippet:0`, `max-snippet:-1`
- **Checks:** `<meta name="robots">`, `<meta name="googlebot">`, X-Robots-Tag header
- **Fix:** Remove nosnippet unless needed for sensitive content

#### core-seo-robots-meta
- **What it checks:** Restrictive indexing directives
- **Detects:** noindex, nofollow, noarchive, noimageindex, none
- **Checks:** robots, googlebot, bingbot meta tags and X-Robots-Tag header
- **Fix:** Remove restrictive directives unless intentionally blocking

#### core-seo-title-unique
- **What it checks:** Duplicate page titles across crawled pages
- **Pass:** Title is unique
- **Warn:** Title appears on multiple pages
- **Fail:** No title tag present
- **Fix:** Create unique titles like "Page Topic | Brand Name"

---

## Meta Tags

Validates title, description, canonical, and other essential meta tags.

| Rule ID | Name | Severity | Description |
|---------|------|----------|-------------|
| `meta-tags-title-present` | Title Present | fail | Checks for `<title>` tag in document head |
| `meta-tags-title-length` | Title Length | warn | Validates title length (30-60 characters) |
| `meta-tags-description-present` | Description Present | fail | Checks for `<meta name="description">` tag |
| `meta-tags-description-length` | Description Length | warn | Validates description length (120-160 characters) |
| `meta-tags-canonical-present` | Canonical Present | fail | Checks for `<link rel="canonical">` tag |
| `meta-tags-canonical-valid` | Canonical Valid | warn | Validates canonical URL format and accessibility |
| `meta-tags-viewport-present` | Viewport Present | fail | Checks for `<meta name="viewport">` tag |
| `meta-tags-favicon-present` | Favicon Present | warn | Checks for favicon link tags |

### Rule Details

#### meta-tags-title-present
- **What it checks:** `<title>` tag exists in document
- **Fix:** Add `<title>Page Title</title>` in `<head>`

#### meta-tags-title-length
- **Optimal:** 30-60 characters
- **Too short:** < 30 characters
- **Too long:** > 60 characters (may be truncated in SERPs)

#### meta-tags-description-present
- **What it checks:** `<meta name="description" content="...">` exists
- **Fix:** Add `<meta name="description" content="Compelling summary">`

#### meta-tags-description-length
- **Optimal:** 120-160 characters
- **Too short:** < 120 characters
- **Too long:** > 160 characters (may be truncated)

#### meta-tags-canonical-present
- **What it checks:** `<link rel="canonical" href="...">` exists
- **Fix:** Add `<link rel="canonical" href="https://example.com/page">`

#### meta-tags-canonical-valid
- **What it checks:** Canonical URL is absolute and accessible
- **Validates:** Protocol, format, reachability

#### meta-tags-viewport-present
- **What it checks:** Mobile viewport configuration
- **Fix:** Add `<meta name="viewport" content="width=device-width, initial-scale=1">`

#### meta-tags-favicon-present
- **What it checks:** Favicon link tags exist
- **Recommended formats:** .ico (legacy), .svg (modern), apple-touch-icon (iOS)

---

## Headings

Checks heading structure and hierarchy (H1-H6).

| Rule ID | Name | Severity | Description |
|---------|------|----------|-------------|
| `headings-h1-present` | H1 Present | fail | Checks for at least one `<h1>` tag |
| `headings-h1-single` | H1 Single | warn | Validates only one `<h1>` exists per page |
| `headings-hierarchy` | Heading Hierarchy | warn | Checks proper heading level sequence (no skipping) |
| `headings-content-length` | Content Length | warn | Validates heading text isn't too short or long |
| `headings-content-unique` | Content Unique | warn | Checks headings aren't duplicated on page |

### Rule Details

#### headings-h1-present
- **What it checks:** At least one H1 exists
- **Fix:** Add a single, descriptive H1 that represents the main topic

#### headings-h1-single
- **What it checks:** Only one H1 per page
- **Why:** Multiple H1s dilute topic focus for search engines
- **Fix:** Convert additional H1s to H2 or lower

#### headings-hierarchy
- **What it checks:** Heading levels don't skip (H1→H3 skips H2)
- **Valid:** H1 → H2 → H3
- **Invalid:** H1 → H3 (skips H2)

#### headings-content-length
- **What it checks:** Heading text is meaningful
- **Too short:** < 3 characters
- **Too long:** > 100 characters

#### headings-content-unique
- **What it checks:** No duplicate heading text on page
- **Why:** Duplicate headings confuse content structure

---

## Technical SEO

Validates robots.txt, sitemap, SSL, and other technical aspects.

| Rule ID | Name | Severity | Description |
|---------|------|----------|-------------|
| `technical-robots-txt-exists` | Robots.txt Exists | warn | Checks /robots.txt exists |
| `technical-robots-txt-valid` | Robots.txt Valid | warn | Validates robots.txt syntax |
| `technical-sitemap-exists` | Sitemap Exists | warn | Checks for XML sitemap |
| `technical-sitemap-valid` | Sitemap Valid | warn | Validates sitemap format and entries |
| `technical-url-structure` | URL Structure | warn | Checks URL format (lowercase, hyphens) |
| `technical-trailing-slash` | Trailing Slash | warn | Checks consistent trailing slash usage |
| `technical-www-redirect` | WWW Redirect | warn | Validates www/non-www consistency |
| `technical-404-page` | 404 Page | warn | Checks for custom 404 page |

### Rule Details

#### technical-robots-txt-exists
- **What it checks:** /robots.txt is accessible
- **Fix:** Create robots.txt with crawl rules

#### technical-robots-txt-valid
- **What it checks:** robots.txt syntax is valid
- **Validates:** User-agent, Allow, Disallow, Sitemap directives

#### technical-sitemap-exists
- **What it checks:** XML sitemap exists at /sitemap.xml or in robots.txt
- **Fix:** Create sitemap.xml with all canonical URLs

#### technical-sitemap-valid
- **What it checks:** Sitemap follows XML sitemap protocol
- **Validates:** Format, URL entries, lastmod dates

#### technical-url-structure
- **What it checks:** URL best practices
- **Good:** Lowercase, hyphens, descriptive
- **Bad:** Uppercase, underscores, special characters

#### technical-trailing-slash
- **What it checks:** Consistent trailing slash usage
- **Why:** /page and /page/ should not both work (duplicate content)

#### technical-www-redirect
- **What it checks:** www and non-www redirect to one canonical form
- **Fix:** Set up 301 redirect to preferred version

#### technical-404-page
- **What it checks:** Custom 404 page with navigation
- **Fix:** Create helpful 404 page with links to main content

---

## Core Web Vitals

Measures LCP, CLS, FCP, TTFB, and INP performance metrics.

| Rule ID | Name | Severity | Description |
|---------|------|----------|-------------|
| `core-web-vitals-lcp` | LCP | warn/fail | Largest Contentful Paint (< 2.5s good) |
| `core-web-vitals-cls` | CLS | warn/fail | Cumulative Layout Shift (< 0.1 good) |
| `core-web-vitals-fcp` | FCP | warn/fail | First Contentful Paint (< 1.8s good) |
| `core-web-vitals-ttfb` | TTFB | warn/fail | Time to First Byte (< 800ms good) |
| `core-web-vitals-inp` | INP | warn/fail | Interaction to Next Paint (< 200ms good) |

### Thresholds

| Metric | Good | Needs Improvement | Poor |
|--------|------|-------------------|------|
| LCP | ≤ 2.5s | 2.5-4.0s | > 4.0s |
| CLS | ≤ 0.1 | 0.1-0.25 | > 0.25 |
| FCP | ≤ 1.8s | 1.8-3.0s | > 3.0s |
| TTFB | ≤ 800ms | 800-1800ms | > 1800ms |
| INP | ≤ 200ms | 200-500ms | > 500ms |

### Common Fixes

- **LCP:** Optimize largest image, use CDN, preload critical assets
- **CLS:** Set width/height on images, avoid inserting content above existing
- **FCP:** Reduce server response time, eliminate render-blocking resources
- **TTFB:** Use CDN, optimize server, enable caching
- **INP:** Optimize JavaScript, break up long tasks

---

## Links

Analyzes internal and external links, anchor text, broken links, and link quality.

| Rule ID | Name | Severity | Description |
|---------|------|----------|-------------|
| `links-broken-internal` | Broken Internal | fail | Checks internal links return 200 |
| `links-external-valid` | External Valid | warn | Checks external links are accessible |
| `links-internal-present` | Internal Links Present | warn | Checks page has internal links |
| `links-nofollow-appropriate` | Nofollow Appropriate | warn | Validates nofollow usage |
| `links-anchor-text` | Anchor Text | warn | Checks descriptive anchor text |
| `links-depth` | Link Depth | warn | Validates pages reachable in ≤ 3 clicks |
| `links-dead-end-pages` | Dead-End Pages | warn | Checks page has outgoing internal links |
| `links-https-downgrade` | HTTPS Downgrade | warn | Checks HTTPS pages don't link to HTTP |
| `links-external-count` | External Links Count | warn | Warns if >100 external links (link farm signal) |
| `links-invalid` | Invalid Links | warn | Detects empty, javascript:, or malformed hrefs |
| `links-tel-mailto` | Tel & Mailto Valid | warn | Validates tel: and mailto: link formats |
| `links-redirect-chains` | Redirect Chains | warn/fail | Detects links going through multiple redirects |
| `links-orphan-pages` | Orphan Pages | info | Checks for pages with no incoming links (crawl mode) |

### Rule Details

#### links-broken-internal
- **What it checks:** Internal links don't return 404
- **Fix:** Update or remove broken links

#### links-external-valid
- **What it checks:** External links are reachable
- **Note:** Results are cached to reduce requests

#### links-internal-present
- **What it checks:** Page has links to other site pages
- **Why:** Internal linking improves crawlability

#### links-nofollow-appropriate
- **What it checks:** nofollow used appropriately
- **Good uses:** Paid links, user-generated content, login pages

#### links-anchor-text
- **What it checks:** Descriptive link text
- **Bad:** "click here", "read more", "link"
- **Good:** Descriptive text explaining destination

#### links-depth
- **What it checks:** Page reachable within 3 clicks from homepage
- **Fix:** Restructure navigation, add internal links

#### links-dead-end-pages
- **What it checks:** Page has at least one outgoing internal link
- **Why:** Dead-end pages hurt user experience and crawlability
- **Fix:** Add navigation links, related content, or breadcrumbs

#### links-https-downgrade
- **What it checks:** HTTPS pages don't link to HTTP URLs
- **Why:** Mixed content can cause security warnings
- **Fix:** Update HTTP links to HTTPS or remove insecure links

#### links-external-count
- **What it checks:** Number of external links on page
- **Threshold:** >100 external links triggers warning
- **Why:** Excessive external links can signal a link farm
- **Fix:** Reduce to essential, high-quality resources only

#### links-invalid
- **What it checks:** Link href attribute validity
- **Detects:** Empty href, `href="#"`, `javascript:*`, malformed URLs
- **Fix:** Replace javascript: links with buttons, fix malformed URLs

#### links-tel-mailto
- **What it checks:** Phone and email link formats
- **Phone format:** E.164-like (7-15 digits with optional +, spaces, dashes)
- **Email format:** Basic email validation (user@domain.tld)
- **Fix:** Use `tel:+1234567890` format, valid email addresses

#### links-redirect-chains
- **What it checks:** Internal links that redirect
- **Warn:** 1-2 redirect hops
- **Fail:** 3+ redirect hops
- **Why:** Redirect chains waste crawl budget and slow navigation
- **Fix:** Update links to point directly to final destination URLs

#### links-orphan-pages
- **What it checks:** Pages with no incoming internal links
- **Note:** Full detection requires crawl mode to build link graph
- **Fix:** Add internal links from other pages to improve discoverability

---

## Images

Checks alt attributes, dimensions, lazy loading, optimization, and accessibility.

| Rule ID | Name | Severity | Description |
|---------|------|----------|-------------|
| `images-alt-present` | Alt Present | fail | Checks all images have alt attribute |
| `images-alt-quality` | Alt Quality | warn | Validates alt text is descriptive |
| `images-dimensions` | Dimensions | warn | Checks width/height attributes present |
| `images-lazy-loading` | Lazy Loading | warn | Checks below-fold images use lazy loading |
| `images-modern-format` | Modern Format | warn | Suggests WebP/AVIF for images |
| `images-size` | Size | warn | Checks image file sizes aren't excessive |
| `images-responsive` | Responsive | warn | Checks srcset for responsive images |
| `images-broken` | No Broken Images | fail | Checks images don't return 404 errors |
| `images-figure-captions` | Figure Captions | warn | Checks figure elements have figcaption |
| `images-filename-quality` | Filename Quality | warn | Checks for descriptive image filenames |
| `images-inline-svg-size` | Inline SVG Size | warn | Checks inline SVGs aren't too large (>5KB) |
| `images-picture-element` | Picture Element | fail | Validates picture elements have img fallback |

### Rule Details

#### images-alt-present
- **What it checks:** All `<img>` have alt attribute
- **Fix:** Add descriptive alt text: `<img alt="Description">`

#### images-alt-quality
- **What it checks:** Alt text is meaningful
- **Bad:** "image", "photo", filename
- **Good:** Descriptive explanation of image content

#### images-dimensions
- **What it checks:** width and height attributes
- **Why:** Prevents CLS (layout shift)
- **Fix:** Add `<img width="800" height="600">`

#### images-lazy-loading
- **What it checks:** Below-fold images have `loading="lazy"`
- **Fix:** Add `<img loading="lazy">` to images below initial viewport

#### images-modern-format
- **What it checks:** Using WebP or AVIF formats
- **Fix:** Convert images to modern formats (30-50% smaller)

#### images-size
- **What it checks:** Image file size
- **Optimal:** < 200KB for most images
- **Fix:** Compress images, use appropriate dimensions

#### images-responsive
- **What it checks:** srcset attribute for responsive images
- **Fix:** Add `srcset` for different screen sizes

#### images-broken
- **What it checks:** All image URLs return 200 status
- **Fix:** Remove or fix broken image references (404 errors)

#### images-figure-captions
- **What it checks:** Figure elements have figcaption for accessibility
- **Fix:** Add `<figcaption>` inside `<figure>` to describe content

#### images-filename-quality
- **What it checks:** Descriptive filenames instead of generic patterns
- **Bad:** `IMG_001.jpg`, `DSC1234.png`, `untitled.webp`
- **Good:** `red-running-shoes.jpg`, `team-photo-2024.webp`

#### images-inline-svg-size
- **What it checks:** Inline SVGs are small enough to not bloat HTML
- **Threshold:** >5KB should be external files
- **Fix:** Move large SVGs to external files for caching

#### images-picture-element
- **What it checks:** Picture elements have required img fallback
- **Fix:** Every `<picture>` must contain `<img>` as fallback

---

## Security

Validates HTTPS, security headers, mixed content, and leaked secrets.

| Rule ID | Name | Severity | Description |
|---------|------|----------|-------------|
| `security-https` | HTTPS | fail | Checks site uses HTTPS |
| `security-https-redirect` | HTTPS Redirect | warn | Checks HTTP redirects to HTTPS |
| `security-hsts` | HSTS | warn | Checks Strict-Transport-Security header |
| `security-csp` | CSP | warn | Checks Content-Security-Policy header |
| `security-x-frame` | X-Frame-Options | warn | Checks X-Frame-Options header |
| `security-x-content-type` | X-Content-Type | warn | Checks X-Content-Type-Options header |
| `security-external-links` | External Link Security | warn | Checks target="_blank" links have noopener/noreferrer |
| `security-form-https` | Form HTTPS | warn/fail | Checks form actions use HTTPS |
| `security-mixed-content` | Mixed Content | warn/fail | Checks for HTTP resources on HTTPS pages |
| `security-permissions-policy` | Permissions-Policy | warn | Checks for Permissions-Policy header |
| `security-referrer-policy` | Referrer-Policy | warn | Checks for Referrer-Policy header |
| `security-leaked-secrets` | Leaked Secrets | fail | Detects exposed API keys, credentials in HTML/JS |

### Rule Details

#### security-https
- **What it checks:** Site served over HTTPS
- **Fix:** Install SSL certificate, update URLs

#### security-https-redirect
- **What it checks:** HTTP URLs redirect to HTTPS
- **Fix:** Set up 301 redirect from HTTP to HTTPS

#### security-hsts
- **What it checks:** HSTS header prevents downgrade attacks
- **Fix:** Add header: `Strict-Transport-Security: max-age=31536000`

#### security-csp
- **What it checks:** Content-Security-Policy header exists
- **Fix:** Add CSP header restricting resource sources

#### security-x-frame
- **What it checks:** X-Frame-Options prevents clickjacking
- **Fix:** Add header: `X-Frame-Options: DENY` or `SAMEORIGIN`

#### security-x-content-type
- **What it checks:** X-Content-Type-Options prevents MIME sniffing
- **Fix:** Add header: `X-Content-Type-Options: nosniff`

#### security-external-links
- **What it checks:** External links with `target="_blank"` have security attributes
- **Fix:** Add `rel="noopener noreferrer"` to prevent window.opener access

#### security-form-https
- **What it checks:** Form actions don't submit to HTTP URLs
- **Fix:** Update form action URLs to use HTTPS

#### security-mixed-content
- **What it checks:** HTTPS pages don't load HTTP resources
- **Fix:** Replace HTTP resource URLs with HTTPS or protocol-relative URLs

#### security-permissions-policy
- **What it checks:** Permissions-Policy header controls browser features
- **Fix:** Add header: `Permissions-Policy: camera=(), microphone=(), geolocation=()`

#### security-referrer-policy
- **What it checks:** Referrer-Policy controls referrer information
- **Fix:** Add header: `Referrer-Policy: strict-origin-when-cross-origin`

#### security-leaked-secrets
- **What it checks:** Scans for exposed AWS keys, API tokens, private keys, database URLs
- **Fix:** Remove secrets immediately, rotate compromised credentials

---

## Structured Data

Checks for valid JSON-LD, Schema.org markup, and rich snippets.

| Rule ID | Name | Severity | Description |
|---------|------|----------|-------------|
| `structured-data-present` | Present | warn | Checks for JSON-LD structured data |
| `structured-data-valid` | Valid | fail | Validates JSON-LD syntax |
| `structured-data-type` | Type | warn | Checks @type is specified |
| `structured-data-required-fields` | Required Fields | warn | Validates required properties for type |
| `structured-data-article` | Article Schema | warn | Validates Article/NewsArticle/BlogPosting |
| `structured-data-breadcrumb` | Breadcrumb Schema | info | Checks BreadcrumbList on non-homepage |
| `structured-data-faq` | FAQ Schema | fail | Validates FAQPage structure |
| `structured-data-local-business` | LocalBusiness Schema | warn | Validates LocalBusiness for local SEO |
| `structured-data-organization` | Organization Schema | info | Validates Organization schema |
| `structured-data-product` | Product Schema | fail | Validates Product for e-commerce |
| `structured-data-review` | Review Schema | warn | Validates Review/AggregateRating |
| `structured-data-video` | Video Schema | warn | Validates VideoObject schema |
| `structured-data-website-search` | WebSite Search | info | Checks sitelinks searchbox eligibility |

### Rule Details

#### structured-data-present
- **What it checks:** `<script type="application/ld+json">` exists
- **Fix:** Add JSON-LD structured data for page type

#### structured-data-valid
- **What it checks:** JSON-LD is valid JSON
- **Fix:** Fix JSON syntax errors

#### structured-data-type
- **What it checks:** @type property specified
- **Common types:** WebPage, Article, Product, Organization

#### structured-data-required-fields
- **What it checks:** Required properties for schema type
- **Example:** Article needs headline, datePublished, author

#### structured-data-article
- **What it checks:** Article/NewsArticle/BlogPosting has headline, author, datePublished
- **Fix:** Add author as Person/Organization object, not string

#### structured-data-breadcrumb
- **What it checks:** BreadcrumbList on non-homepage with itemListElement
- **Fix:** Add at least 2 breadcrumb items for navigation hierarchy

#### structured-data-faq
- **What it checks:** FAQPage has mainEntity with Question/Answer pairs
- **Fix:** Each Question needs name and acceptedAnswer with text

#### structured-data-local-business
- **What it checks:** LocalBusiness has name, address, geo coordinates
- **Fix:** Use PostalAddress object for address, not string

#### structured-data-organization
- **What it checks:** Organization has name, logo, sameAs social profiles
- **Fix:** Add logo URL and sameAs array with social media URLs

#### structured-data-product
- **What it checks:** Product has offers with price, priceCurrency, availability
- **Fix:** Add Offer object with required pricing fields

#### structured-data-review
- **What it checks:** Review has itemReviewed, author; AggregateRating has ratingValue
- **Fix:** Add ratingValue and reviewCount or ratingCount

#### structured-data-video
- **What it checks:** VideoObject has name, thumbnailUrl, uploadDate
- **Fix:** Use ISO 8601 format for duration (PT1M30S) and dates

#### structured-data-website-search
- **What it checks:** WebSite schema with SearchAction for sitelinks searchbox
- **Fix:** Add potentialAction with target containing {search_term_string}

### Example

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "WebPage",
  "name": "Page Title",
  "description": "Page description"
}
</script>
```

---

## Social

Validates Open Graph, Twitter Cards, and social sharing metadata.

| Rule ID | Name | Severity | Description |
|---------|------|----------|-------------|
| `social-og-title` | OG Title | warn | Checks og:title meta tag |
| `social-og-description` | OG Description | warn | Checks og:description meta tag |
| `social-og-image` | OG Image | warn | Checks og:image meta tag |
| `social-og-url` | OG URL | warn | Checks og:url meta tag |
| `social-twitter-card` | Twitter Card | warn | Checks twitter:card meta tag |

### Rule Details

#### social-og-title
- **What it checks:** `<meta property="og:title">` exists
- **Optimal length:** ≤ 60 characters
- **Fix:** Add `<meta property="og:title" content="Title">`

#### social-og-description
- **What it checks:** `<meta property="og:description">` exists
- **Optimal length:** ≤ 200 characters
- **Fix:** Add `<meta property="og:description" content="Description">`

#### social-og-image
- **What it checks:** `<meta property="og:image">` exists
- **Optimal size:** 1200x630 pixels for social sharing
- **Fix:** Add `<meta property="og:image" content="https://...image.jpg">`

#### social-og-url
- **What it checks:** `<meta property="og:url">` exists
- **Fix:** Add `<meta property="og:url" content="https://canonical-url">`

#### social-twitter-card
- **What it checks:** `<meta name="twitter:card">` exists
- **Types:** summary, summary_large_image, player, app
- **Fix:** Add `<meta name="twitter:card" content="summary_large_image">`

---

## Content

Analyzes text quality, readability, keyword density, and content structure.

| Rule ID | Name | Severity | Description |
|---------|------|----------|-------------|
| `content-word-count` | Word Count | warn/fail | Checks content length for thin content issues |
| `content-reading-level` | Reading Level | warn | Analyzes readability using Flesch-Kincaid score |
| `content-keyword-stuffing` | Keyword Stuffing | warn/fail | Detects excessive keyword repetition |
| `content-article-links` | Article Link Density | warn | Checks link-to-content ratio |
| `content-author-info` | Author Info | warn | Checks for author markup (E-E-A-T) |
| `content-freshness` | Content Freshness | warn | Checks for date signals (datePublished, dateModified) |
| `content-broken-html` | Broken HTML | warn/fail | Detects malformed HTML structure |
| `content-meta-in-body` | Meta Tags in Body | fail | Detects meta tags incorrectly placed in body |
| `content-mime-type` | MIME Type | warn/fail | Validates Content-Type header |
| `content-duplicate-description` | Duplicate Description | warn/fail | Checks for duplicate meta descriptions (site-wide) |

### Rule Details

#### content-word-count
- **What it checks:** Main content word count (excluding nav, footer, scripts)
- **Pass:** >= 300 words
- **Warn:** 100-299 words (thin content)
- **Fail:** < 100 words (extremely thin)
- **Fix:** Expand content to cover topic thoroughly; 500+ words for pages, 1000+ for articles

#### content-reading-level
- **What it checks:** Flesch-Kincaid Reading Ease score
- **Optimal:** 60-70 (8th-9th grade, accessible to general audience)
- **Too complex:** < 50 (college level)
- **Too simple:** > 80 (elementary level)
- **Fix:** Use shorter sentences, simpler vocabulary, bullet points

#### content-keyword-stuffing
- **What it checks:** Word frequency after removing stopwords
- **Pass:** No word exceeds 2% density
- **Warn:** 1-2 words exceed 2% density
- **Fail:** Any word > 5% density or 3+ words > 2%
- **Fix:** Use synonyms and related terms; write naturally for users

#### content-article-links
- **What it checks:** Links per 100 words of content
- **Optimal:** 0.5-5 links per 100 words
- **Too sparse:** < 0.5 links per 100 words
- **Too dense:** > 5 links per 100 words
- **Fix:** Add internal links to related content, cite external sources

#### content-author-info
- **What it checks:** Author attribution for E-E-A-T signals
- **Detects:** Schema.org author, rel="author" links, meta author tag, byline elements
- **Pass:** Any author signal found
- **Warn:** No author info
- **Fix:** Add author name with Person schema, link to author bio page

#### content-freshness
- **What it checks:** Date signals indicating content currency
- **Detects:** Schema.org datePublished/dateModified, `<time>` elements, article:published_time meta, Last-Modified header
- **Pass:** Any date signal found
- **Warn:** No date signals
- **Fix:** Add datePublished and dateModified to Article schema

#### content-broken-html
- **What it checks:** HTML structure validity
- **Detects:** Duplicate IDs, invalid nesting, empty headings/buttons, missing attributes, deprecated elements
- **Pass:** No issues
- **Warn:** 1-3 issues
- **Fail:** 4+ issues
- **Fix:** Use HTML validator, fix structural problems

#### content-meta-in-body
- **What it checks:** Meta tags incorrectly placed in document body
- **Detects:** `<meta>`, `<title>`, `<link rel="canonical">` inside `<body>`
- **Pass:** All meta elements in `<head>`
- **Fail:** Any meta element in `<body>`
- **Fix:** Move all meta tags to `<head>`; check HTML template for errors

#### content-mime-type
- **What it checks:** Content-Type HTTP header
- **Pass:** `text/html; charset=utf-8`
- **Warn:** Missing charset or non-UTF-8
- **Fail:** Wrong MIME type or missing header
- **Fix:** Configure server to send `Content-Type: text/html; charset=utf-8`

#### content-duplicate-description
- **What it checks:** Unique meta descriptions across crawled pages
- **Pass:** Description is unique
- **Warn:** Description appears on multiple pages
- **Fail:** No meta description
- **Fix:** Write unique, compelling descriptions (120-160 chars) for each page

---

## Accessibility

Checks for WCAG compliance, screen reader support, and keyboard navigation.

| Rule ID | Name | Severity | Description |
|---------|------|----------|-------------|
| `a11y-aria-labels` | ARIA Labels | warn/fail | Checks interactive elements have accessible names |
| `a11y-color-contrast` | Color Contrast | warn | Detects potential color contrast issues |
| `a11y-focus-visible` | Focus Visible | warn/fail | Checks for focus indicator styles |
| `a11y-form-labels` | Form Labels | warn/fail | Checks form inputs have associated labels |
| `a11y-heading-order` | Heading Order | warn/fail | Checks heading levels don't skip |
| `a11y-landmark-regions` | Landmark Regions | warn | Checks for proper landmark regions (main, nav, footer) |
| `a11y-link-text` | Link Text | warn/fail | Checks for descriptive link text |
| `a11y-skip-link` | Skip Link | warn | Checks for skip-to-content link for keyboard navigation |
| `a11y-table-headers` | Table Headers | warn/fail | Checks data tables have proper headers |
| `a11y-touch-targets` | Touch Targets | warn | Checks for minimum touch target sizing |
| `a11y-video-captions` | Video Captions | warn/fail | Checks videos have captions or transcripts |
| `a11y-zoom-disabled` | Zoom Disabled | fail | Checks if viewport disables user zoom |

### Rule Details

#### a11y-aria-labels
- **What it checks:** Interactive elements (buttons, links, inputs) for accessible names
- **Pass:** All interactive elements have accessible names (text, aria-label, or title)
- **Warn:** 1-5 elements missing accessible names
- **Fail:** More than 5 elements missing accessible names
- **Fix:** Add aria-label, visible text content, or title attribute to interactive elements

#### a11y-color-contrast
- **What it checks:** Inline styles for potential low contrast color combinations
- **Pass:** No obvious contrast issues detected
- **Warn:** Potential contrast issues found (light gray text, text on images)
- **Fix:** Ensure minimum 4.5:1 contrast ratio for normal text, 3:1 for large text

#### a11y-focus-visible
- **What it checks:** CSS for focus indicator removal (outline: none without alternatives)
- **Pass:** No focus indicator issues
- **Warn:** Focus styles removed but :focus-visible detected
- **Fail:** Global or widespread focus outline removal
- **Fix:** Keep visible focus indicators; use :focus-visible for keyboard-only focus styles

#### a11y-form-labels
- **What it checks:** Form inputs for associated labels via `<label for>`, aria-label, or wrapping label
- **Pass:** All form inputs have labels
- **Warn:** Some inputs missing labels
- **Fail:** More than 30% of inputs lack labels
- **Fix:** Add `<label for="inputId">` or aria-label attribute; placeholder is not a substitute

#### a11y-heading-order
- **What it checks:** Heading hierarchy for skipped levels (e.g., H1 → H3)
- **Pass:** Proper heading hierarchy (H1 → H2 → H3)
- **Warn:** 1-3 heading hierarchy issues
- **Fail:** Multiple heading skips or first heading is not H1
- **Fix:** Use proper sequence (H1 → H2 → H3); don't skip levels

#### a11y-landmark-regions
- **What it checks:** Presence of landmark elements: main, nav, header, footer
- **Pass:** All essential landmarks present
- **Warn:** Missing some landmark regions
- **Fix:** Add `<main>`, `<nav>`, `<header>`, `<footer>` elements for screen reader navigation

#### a11y-link-text
- **What it checks:** Link text for generic phrases ("click here", "read more", "here")
- **Pass:** All links have descriptive text
- **Warn:** Some links use generic text
- **Fail:** Many links with generic or empty text
- **Fix:** Use descriptive link text that makes sense out of context

#### a11y-skip-link
- **What it checks:** Presence of skip-to-content link early in the page
- **Pass:** Skip link found pointing to main content
- **Warn:** No skip link (unless page is very simple)
- **Fix:** Add `<a href="#main" class="skip-link">Skip to content</a>` before navigation

#### a11y-table-headers
- **What it checks:** Data tables for `<th>` elements with scope attributes
- **Pass:** All data tables have proper headers
- **Warn:** Tables missing scope attributes or captions
- **Fail:** Tables without any header cells
- **Fix:** Use `<th scope="col">` for column headers, `<th scope="row">` for row headers

#### a11y-touch-targets
- **What it checks:** Interactive elements for minimum 44x44px touch target size
- **Pass:** No obvious small touch targets
- **Warn:** Potential small touch targets detected
- **Fix:** Ensure buttons/links are at least 44x44 CSS pixels (WCAG 2.5.8)

#### a11y-video-captions
- **What it checks:** Video/audio elements for captions or transcripts
- **Pass:** All media has captions or transcript links
- **Warn:** Some media may need captions
- **Fail:** Multiple videos without captions
- **Fix:** Add `<track kind="captions">` or link to transcript near video

#### a11y-zoom-disabled
- **What it checks:** Viewport meta tag for zoom-blocking settings
- **Pass:** User zoom is allowed
- **Fail:** user-scalable=no or maximum-scale≤1 prevents zooming
- **Fix:** Remove user-scalable=no and maximum-scale=1 from viewport meta tag

---

## Internationalization

Checks language declarations and multi-region hreflang support.

| Rule ID | Name | Severity | Description |
|---------|------|----------|-------------|
| `i18n-lang-attribute` | Lang Attribute | fail | Checks for `lang` attribute on `<html>` element |
| `i18n-hreflang` | Hreflang Tags | warn/fail | Checks for hreflang link elements for international targeting |

### Rule Details

#### i18n-lang-attribute
- **What it checks:** `<html lang="xx">` exists with valid BCP 47 language code
- **Pass:** Valid lang attribute present (e.g., "en", "en-US", "zh-Hans")
- **Warn:** Lang attribute format may be invalid
- **Fail:** Missing or empty lang attribute
- **Fix:** Add `<html lang="en">` with appropriate language code

#### i18n-hreflang
- **What it checks:** Hreflang link elements for multi-language/region sites
- **Pass (no hreflang):** Single-language sites without hreflang are valid
- **Pass (with hreflang):** Valid hreflang implementation with self-reference
- **Warn:** Missing x-default or self-reference recommendations
- **Fail:** Invalid hreflang format, duplicate codes, or relative URLs
- **Fix:** Add `<link rel="alternate" hreflang="xx" href="...">` for each language version

---

## Disabling Rules

### Disable Specific Rule
```toml
[rules]
disable = ["core-seo-nosnippet"]
```

### Disable Category
```toml
[rules]
disable = ["core-seo-*"]   # All Core SEO rules
disable = ["security-*"]   # All Security rules
```

### Enable Only Specific Rules
```toml
[rules]
enable = ["meta-tags-*", "headings-*"]
disable = ["*"]
```

---

## Score Calculation

1. Each rule returns a score (0, 50, or 100)
2. Category score = weighted average of rule scores within category
3. Overall score = weighted average of category scores

### Example
- Core SEO: 75/100 × 6% = 4.5
- Meta Tags: 90/100 × 13% = 11.7
- ...
- **Overall: Sum of all category contributions**

---

## Resources

- **CLI:** `npm install -g @seomator/seo-audit`
- **npm:** https://www.npmjs.com/package/@seomator/seo-audit
- **GitHub:** https://github.com/seo-skills/seo-audit-skill
- **Web UI:** https://seomator.com/free-seo-audit-tool
