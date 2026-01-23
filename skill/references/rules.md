# SEOmator Audit Rules Reference

## Meta Tags (8 rules) - 15% weight

| Rule ID | Name | Description |
|---------|------|-------------|
| `meta-tags-title-present` | Title Tag Present | Check `<title>` tag exists |
| `meta-tags-title-length` | Title Length | Title should be 30-60 characters |
| `meta-tags-description-present` | Meta Description Present | Check meta description exists |
| `meta-tags-description-length` | Description Length | Description should be 120-160 characters |
| `meta-tags-canonical-present` | Canonical URL Present | Check canonical URL exists |
| `meta-tags-canonical-valid` | Canonical URL Valid | Canonical URL should be valid absolute URL |
| `meta-tags-viewport-present` | Viewport Present | Check viewport meta tag exists |
| `meta-tags-favicon-present` | Favicon Present | Check favicon link exists |

## Headings (6 rules) - 10% weight

| Rule ID | Name | Description |
|---------|------|-------------|
| `headings-h1-present` | H1 Present | At least one H1 should exist |
| `headings-h1-single` | Single H1 | Only one H1 should exist |
| `headings-hierarchy` | Heading Hierarchy | Proper heading hierarchy (no skipped levels) |
| `headings-content-length` | Heading Length | Headings should be 10-70 characters |
| `headings-content-unique` | Unique Headings | Headings should be unique |
| `headings-lang-attribute` | Language Attribute | HTML lang attribute should exist |

## Technical SEO (8 rules) - 15% weight

| Rule ID | Name | Description |
|---------|------|-------------|
| `technical-robots-txt-exists` | robots.txt Exists | robots.txt should return 200 |
| `technical-robots-txt-valid` | robots.txt Valid | robots.txt should have valid syntax |
| `technical-sitemap-exists` | Sitemap Exists | sitemap.xml should exist |
| `technical-sitemap-valid` | Sitemap Valid | Sitemap should have valid XML structure |
| `technical-url-structure` | URL Structure | URL should use hyphens, lowercase |
| `technical-trailing-slash` | Trailing Slash | Consistent trailing slash usage |
| `technical-www-redirect` | WWW Redirect | www/non-www should redirect to one version |
| `technical-404-page` | Custom 404 Page | Custom 404 page should exist |

## Core Web Vitals (5 rules) - 15% weight

| Rule ID | Name | Thresholds |
|---------|------|------------|
| `cwv-lcp` | Largest Contentful Paint | Pass: <2.5s, Warn: 2.5-4s, Fail: >4s |
| `cwv-cls` | Cumulative Layout Shift | Pass: <0.1, Warn: 0.1-0.25, Fail: >0.25 |
| `cwv-inp` | Interaction to Next Paint | Pass: <200ms, Warn: 200-500ms, Fail: >500ms |
| `cwv-ttfb` | Time to First Byte | Pass: <800ms, Warn: 800-1800ms, Fail: >1800ms |
| `cwv-fcp` | First Contentful Paint | Pass: <1.8s, Warn: 1.8-3s, Fail: >3s |

## Links (6 rules) - 10% weight

| Rule ID | Name | Description |
|---------|------|-------------|
| `links-broken-internal` | Broken Internal Links | Internal links should return 200 |
| `links-external-valid` | External Links Valid | External links should be reachable |
| `links-internal-present` | Internal Links Present | Page should have internal links |
| `links-nofollow-appropriate` | Nofollow Usage | nofollow used appropriately |
| `links-anchor-text` | Anchor Text Quality | Anchor text should be descriptive |
| `links-depth` | Page Depth | Page depth should be ≤3 from homepage |

## Images (7 rules) - 10% weight

| Rule ID | Name | Description |
|---------|------|-------------|
| `images-alt-present` | Alt Attribute Present | All images should have alt attribute |
| `images-alt-quality` | Alt Text Quality | Alt text should be descriptive |
| `images-dimensions` | Image Dimensions | Images should have width/height |
| `images-lazy-loading` | Lazy Loading | Below-fold images should use lazy loading |
| `images-modern-format` | Modern Formats | Use WebP/AVIF formats |
| `images-size` | Image Size | Images should be <200KB |
| `images-responsive` | Responsive Images | Use srcset for responsive images |

## Security (6 rules) - 10% weight

| Rule ID | Name | Description |
|---------|------|-------------|
| `security-https` | HTTPS | Site should use HTTPS |
| `security-https-redirect` | HTTPS Redirect | HTTP should redirect to HTTPS |
| `security-hsts` | HSTS Header | Strict-Transport-Security header present |
| `security-csp` | CSP Header | Content-Security-Policy header present |
| `security-x-frame-options` | X-Frame-Options | X-Frame-Options header present |
| `security-x-content-type-options` | X-Content-Type-Options | X-Content-Type-Options: nosniff |

## Structured Data (4 rules) - 8% weight

| Rule ID | Name | Description |
|---------|------|-------------|
| `structured-data-present` | Structured Data Present | JSON-LD or microdata should exist |
| `structured-data-valid` | Structured Data Valid | JSON-LD should be valid JSON |
| `structured-data-type` | Type Field Present | @type field should be present |
| `structured-data-required-fields` | Required Fields | Required fields for schema type |

## Social (5 rules) - 7% weight

| Rule ID | Name | Description |
|---------|------|-------------|
| `social-og-title` | OG Title | og:title meta tag present |
| `social-og-description` | OG Description | og:description meta tag present |
| `social-og-image` | OG Image | og:image with valid URL |
| `social-twitter-card` | Twitter Card | twitter:card meta tag present |
| `social-og-url` | OG URL | og:url meta tag present |
