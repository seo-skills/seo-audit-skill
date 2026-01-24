# Structured Data Rules Expansion Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add 9 type-specific schema validation rules to match SquirrelScan's comprehensive structured data analysis, expanding SEOmator from 4 to 13 structured data rules.

**Architecture:** Create dedicated rule files for each major schema type. Extract shared JSON-LD parsing utilities to a common module. Each rule detects if its schema type exists and validates type-specific requirements.

**Tech Stack:** TypeScript, Cheerio for DOM parsing, existing `defineRule` pattern.

---

## New Rules Summary

| # | Rule | ID | Severity | Purpose |
|---|------|----|----------|---------|
| 1 | Article Schema | `structured-data-article` | warn | Validate Article/NewsArticle/BlogPosting |
| 2 | Breadcrumb Schema | `structured-data-breadcrumb` | info | Check BreadcrumbList on non-homepage |
| 3 | FAQ Schema | `structured-data-faq` | warn | Validate FAQPage with Question/Answer |
| 4 | LocalBusiness Schema | `structured-data-local-business` | warn | Validate address, geo, openingHours |
| 5 | Organization Schema | `structured-data-organization` | info | Validate name, logo, contactPoint |
| 6 | Product Schema | `structured-data-product` | warn | Validate offers with price/availability |
| 7 | Review Schema | `structured-data-review` | warn | Validate AggregateRating fields |
| 8 | Video Schema | `structured-data-video` | warn | Validate VideoObject requirements |
| 9 | WebSite Search Schema | `structured-data-website-search` | info | Check sitelinks searchbox eligibility |

---

## Files to Modify/Create

| File | Action | Purpose |
|------|--------|---------|
| `src/rules/structured-data/utils.ts` | CREATE | Shared JSON-LD parsing utilities |
| `src/rules/structured-data/article.ts` | CREATE | Article schema validation |
| `src/rules/structured-data/breadcrumb.ts` | CREATE | Breadcrumb schema detection |
| `src/rules/structured-data/faq.ts` | CREATE | FAQ schema validation |
| `src/rules/structured-data/local-business.ts` | CREATE | LocalBusiness schema validation |
| `src/rules/structured-data/organization.ts` | CREATE | Organization schema validation |
| `src/rules/structured-data/product.ts` | CREATE | Product schema validation |
| `src/rules/structured-data/review.ts` | CREATE | Review/AggregateRating validation |
| `src/rules/structured-data/video.ts` | CREATE | VideoObject schema validation |
| `src/rules/structured-data/website-search.ts` | CREATE | WebSite sitelinks searchbox |
| `src/rules/structured-data/index.ts` | MODIFY | Register new rules |
| `src/rules/structured-data/required-fields.ts` | MODIFY | Use shared utils |
| `src/reporters/fix-suggestions.ts` | MODIFY | Add fix suggestions |
| `CLAUDE.md` | MODIFY | Update rule count (81→90) |
| `README.md` | MODIFY | Update rule count and add rules |
| `docs/SEO-AUDIT-RULES.md` | MODIFY | Add new rules documentation |

---

## Implementation Tasks

### Task 1: Create Shared Utilities

**File:** `src/rules/structured-data/utils.ts`

Create shared JSON-LD parsing utilities extracted from `required-fields.ts`:

```typescript
import type { CheerioAPI } from 'cheerio';

/**
 * Represents a typed item from JSON-LD
 */
export interface TypedItem {
  type: string;
  data: Record<string, unknown>;
  fields: string[];
}

/**
 * Extract all JSON-LD scripts from page
 */
export function extractJsonLdScripts($: CheerioAPI): unknown[] {
  const scripts: unknown[] = [];
  $('script[type="application/ld+json"]').each((_, element) => {
    const content = $(element).html()?.trim();
    if (content) {
      try {
        scripts.push(JSON.parse(content));
      } catch {
        // Skip invalid JSON
      }
    }
  });
  return scripts;
}

/**
 * Extract all items with @type from JSON-LD (handles @graph)
 */
export function extractTypedItems(data: unknown): TypedItem[] {
  const items: TypedItem[] = [];

  if (!data || typeof data !== 'object') {
    return items;
  }

  const obj = data as Record<string, unknown>;

  // Check direct @type
  if (obj['@type']) {
    const types = Array.isArray(obj['@type'])
      ? (obj['@type'] as string[])
      : [obj['@type'] as string];

    const fields = Object.keys(obj).filter((k) => !k.startsWith('@'));

    for (const type of types) {
      items.push({ type, data: obj, fields });
    }
  }

  // Check @graph array
  if (Array.isArray(obj['@graph'])) {
    for (const item of obj['@graph']) {
      items.push(...extractTypedItems(item));
    }
  }

  // Check nested objects
  for (const key of Object.keys(obj)) {
    if (key !== '@graph' && typeof obj[key] === 'object' && obj[key] !== null) {
      if (Array.isArray(obj[key])) {
        for (const item of obj[key] as unknown[]) {
          items.push(...extractTypedItems(item));
        }
      } else {
        items.push(...extractTypedItems(obj[key]));
      }
    }
  }

  return items;
}

/**
 * Find all items of a specific type (or types)
 */
export function findItemsByType(
  $: CheerioAPI,
  targetTypes: string | string[]
): TypedItem[] {
  const types = Array.isArray(targetTypes) ? targetTypes : [targetTypes];
  const scripts = extractJsonLdScripts($);
  const allItems: TypedItem[] = [];

  for (const script of scripts) {
    allItems.push(...extractTypedItems(script));
  }

  return allItems.filter((item) => types.includes(item.type));
}

/**
 * Check if a field exists and is not empty
 */
export function hasField(item: TypedItem, field: string): boolean {
  const value = item.data[field];
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

/**
 * Get missing fields from a required list
 */
export function getMissingFields(item: TypedItem, required: string[]): string[] {
  return required.filter((field) => !hasField(item, field));
}
```

---

### Task 2: Create Article Schema Rule

**File:** `src/rules/structured-data/article.ts`

Validates Article, NewsArticle, and BlogPosting schemas.

```typescript
import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, fail } from '../define-rule.js';
import { findItemsByType, getMissingFields, hasField } from './utils.js';

const ARTICLE_TYPES = ['Article', 'NewsArticle', 'BlogPosting', 'TechArticle', 'ScholarlyArticle'];
const REQUIRED = ['headline', 'author', 'datePublished'];
const RECOMMENDED = ['image', 'publisher', 'dateModified', 'description', 'mainEntityOfPage'];

export const structuredDataArticleRule = defineRule({
  id: 'structured-data-article',
  name: 'Article Schema',
  description: 'Validates Article schema has required properties for rich results',
  category: 'structured-data',
  weight: 12,
  run: (context: AuditContext) => {
    const { $ } = context;
    const articles = findItemsByType($, ARTICLE_TYPES);

    if (articles.length === 0) {
      return pass('structured-data-article', 'No Article schema found (not required)', {
        found: false,
      });
    }

    const issues: string[] = [];
    const warnings: string[] = [];

    for (const article of articles) {
      const missing = getMissingFields(article, REQUIRED);
      if (missing.length > 0) {
        issues.push(`${article.type}: missing ${missing.join(', ')}`);
      }

      // Check author is properly structured (not just a string)
      if (hasField(article, 'author')) {
        const author = article.data.author;
        if (typeof author === 'string') {
          warnings.push(`${article.type}: author should be Person/Organization object, not string`);
        }
      }

      // Check for recommended fields
      const missingRecommended = getMissingFields(article, RECOMMENDED);
      if (missingRecommended.length > 0) {
        warnings.push(`${article.type}: consider adding ${missingRecommended.join(', ')}`);
      }
    }

    if (issues.length > 0) {
      return fail('structured-data-article', issues.join('; '), {
        articleCount: articles.length,
        issues,
        warnings,
      });
    }

    if (warnings.length > 0) {
      return warn('structured-data-article', `Article schema valid with recommendations: ${warnings.join('; ')}`, {
        articleCount: articles.length,
        warnings,
      });
    }

    return pass('structured-data-article', `${articles.length} Article schema(s) properly configured`, {
      articleCount: articles.length,
      types: articles.map((a) => a.type),
    });
  },
});
```

---

### Task 3: Create Breadcrumb Schema Rule

**File:** `src/rules/structured-data/breadcrumb.ts`

Checks for BreadcrumbList on non-homepage pages.

```typescript
import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn } from '../define-rule.js';
import { findItemsByType, hasField } from './utils.js';

export const structuredDataBreadcrumbRule = defineRule({
  id: 'structured-data-breadcrumb',
  name: 'Breadcrumb Schema',
  description: 'Checks for BreadcrumbList schema on non-homepage pages',
  category: 'structured-data',
  weight: 8,
  run: (context: AuditContext) => {
    const { $, url } = context;

    // Check if this is the homepage
    const urlObj = new URL(url);
    const isHomepage = urlObj.pathname === '/' || urlObj.pathname === '';

    const breadcrumbs = findItemsByType($, 'BreadcrumbList');

    if (breadcrumbs.length === 0) {
      if (isHomepage) {
        return pass('structured-data-breadcrumb', 'Homepage - breadcrumb not required', {
          isHomepage: true,
        });
      }
      return warn('structured-data-breadcrumb', 'Non-homepage missing BreadcrumbList schema', {
        isHomepage: false,
        suggestion: 'Add BreadcrumbList schema to help search engines understand site hierarchy',
      });
    }

    // Validate itemListElement exists
    const issues: string[] = [];
    for (const bc of breadcrumbs) {
      if (!hasField(bc, 'itemListElement')) {
        issues.push('BreadcrumbList missing itemListElement');
      } else {
        const items = bc.data.itemListElement as unknown[];
        if (Array.isArray(items) && items.length < 2) {
          issues.push('BreadcrumbList should have at least 2 items');
        }
      }
    }

    if (issues.length > 0) {
      return warn('structured-data-breadcrumb', issues.join('; '), {
        breadcrumbCount: breadcrumbs.length,
        issues,
      });
    }

    return pass('structured-data-breadcrumb', `BreadcrumbList schema found with valid structure`, {
      breadcrumbCount: breadcrumbs.length,
    });
  },
});
```

---

### Task 4: Create FAQ Schema Rule

**File:** `src/rules/structured-data/faq.ts`

Validates FAQPage schema structure.

```typescript
import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, fail } from '../define-rule.js';
import { findItemsByType, hasField } from './utils.js';

export const structuredDataFaqRule = defineRule({
  id: 'structured-data-faq',
  name: 'FAQ Schema',
  description: 'Validates FAQPage schema has proper Question/Answer structure',
  category: 'structured-data',
  weight: 8,
  run: (context: AuditContext) => {
    const { $ } = context;
    const faqPages = findItemsByType($, 'FAQPage');

    if (faqPages.length === 0) {
      return pass('structured-data-faq', 'No FAQPage schema found (not required)', {
        found: false,
      });
    }

    const issues: string[] = [];
    let totalQuestions = 0;

    for (const faq of faqPages) {
      if (!hasField(faq, 'mainEntity')) {
        issues.push('FAQPage missing mainEntity');
        continue;
      }

      const mainEntity = faq.data.mainEntity as unknown[];
      if (!Array.isArray(mainEntity) || mainEntity.length === 0) {
        issues.push('FAQPage mainEntity should be array of Questions');
        continue;
      }

      // Validate each Question
      for (const q of mainEntity) {
        if (typeof q !== 'object' || q === null) continue;
        const question = q as Record<string, unknown>;

        if (question['@type'] !== 'Question') {
          issues.push('mainEntity items should be type Question');
          continue;
        }

        if (!question.name || (typeof question.name === 'string' && !question.name.trim())) {
          issues.push('Question missing name property');
        }

        if (!question.acceptedAnswer) {
          issues.push('Question missing acceptedAnswer');
        } else {
          const answer = question.acceptedAnswer as Record<string, unknown>;
          if (answer['@type'] !== 'Answer' || !answer.text) {
            issues.push('acceptedAnswer should be Answer type with text');
          }
        }

        totalQuestions++;
      }
    }

    if (issues.length > 0) {
      return fail('structured-data-faq', `FAQPage validation issues: ${issues.slice(0, 3).join('; ')}`, {
        faqCount: faqPages.length,
        questionCount: totalQuestions,
        issues,
      });
    }

    return pass('structured-data-faq', `FAQPage schema valid with ${totalQuestions} question(s)`, {
      faqCount: faqPages.length,
      questionCount: totalQuestions,
    });
  },
});
```

---

### Task 5: Create LocalBusiness Schema Rule

**File:** `src/rules/structured-data/local-business.ts`

Validates LocalBusiness schema for local SEO.

```typescript
import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, fail } from '../define-rule.js';
import { findItemsByType, getMissingFields, hasField } from './utils.js';

const LOCAL_TYPES = [
  'LocalBusiness', 'Restaurant', 'Store', 'MedicalBusiness', 'LegalService',
  'FinancialService', 'RealEstateAgent', 'Dentist', 'Physician', 'Attorney',
];
const REQUIRED = ['name', 'address'];
const RECOMMENDED = ['telephone', 'openingHours', 'geo', 'priceRange', 'image', 'url'];

export const structuredDataLocalBusinessRule = defineRule({
  id: 'structured-data-local-business',
  name: 'LocalBusiness Schema',
  description: 'Validates LocalBusiness schema for local SEO eligibility',
  category: 'structured-data',
  weight: 10,
  run: (context: AuditContext) => {
    const { $ } = context;
    const businesses = findItemsByType($, LOCAL_TYPES);

    if (businesses.length === 0) {
      return pass('structured-data-local-business', 'No LocalBusiness schema found (not required)', {
        found: false,
      });
    }

    const issues: string[] = [];
    const warnings: string[] = [];

    for (const biz of businesses) {
      const missing = getMissingFields(biz, REQUIRED);
      if (missing.length > 0) {
        issues.push(`${biz.type}: missing ${missing.join(', ')}`);
      }

      // Validate address structure
      if (hasField(biz, 'address')) {
        const addr = biz.data.address as Record<string, unknown>;
        if (typeof addr === 'object' && addr !== null) {
          if (!addr.streetAddress || !addr.addressLocality) {
            warnings.push('address should include streetAddress and addressLocality');
          }
        } else if (typeof addr === 'string') {
          warnings.push('address should be PostalAddress object, not string');
        }
      }

      // Check geo coordinates
      if (hasField(biz, 'geo')) {
        const geo = biz.data.geo as Record<string, unknown>;
        if (!geo.latitude || !geo.longitude) {
          warnings.push('geo should include latitude and longitude');
        }
      }

      const missingRecommended = getMissingFields(biz, RECOMMENDED);
      if (missingRecommended.length > 0) {
        warnings.push(`consider adding ${missingRecommended.join(', ')}`);
      }
    }

    if (issues.length > 0) {
      return fail('structured-data-local-business', issues.join('; '), {
        businessCount: businesses.length,
        issues,
        warnings,
      });
    }

    if (warnings.length > 0) {
      return warn('structured-data-local-business', `LocalBusiness valid with suggestions: ${warnings[0]}`, {
        businessCount: businesses.length,
        warnings,
      });
    }

    return pass('structured-data-local-business', `${businesses.length} LocalBusiness schema(s) properly configured`, {
      businessCount: businesses.length,
      types: businesses.map((b) => b.type),
    });
  },
});
```

---

### Task 6: Create Organization Schema Rule

**File:** `src/rules/structured-data/organization.ts`

Validates Organization schema for brand presence.

```typescript
import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn } from '../define-rule.js';
import { findItemsByType, getMissingFields, hasField } from './utils.js';

const REQUIRED = ['name'];
const RECOMMENDED = ['url', 'logo', 'sameAs', 'contactPoint', 'address'];

export const structuredDataOrganizationRule = defineRule({
  id: 'structured-data-organization',
  name: 'Organization Schema',
  description: 'Validates Organization schema for brand knowledge panel eligibility',
  category: 'structured-data',
  weight: 8,
  run: (context: AuditContext) => {
    const { $ } = context;
    const orgs = findItemsByType($, ['Organization', 'Corporation', 'NGO', 'GovernmentOrganization']);

    if (orgs.length === 0) {
      return pass('structured-data-organization', 'No Organization schema found (not required)', {
        found: false,
      });
    }

    const warnings: string[] = [];

    for (const org of orgs) {
      const missing = getMissingFields(org, REQUIRED);
      if (missing.length > 0) {
        return warn('structured-data-organization', `Organization missing: ${missing.join(', ')}`, {
          orgCount: orgs.length,
          missing,
        });
      }

      // Check logo is proper ImageObject or URL
      if (hasField(org, 'logo')) {
        const logo = org.data.logo;
        if (typeof logo === 'string' && !logo.startsWith('http')) {
          warnings.push('logo should be absolute URL');
        }
      } else {
        warnings.push('consider adding logo for brand visibility');
      }

      // Check sameAs for social profiles
      if (!hasField(org, 'sameAs')) {
        warnings.push('consider adding sameAs with social media profiles');
      }

      const missingRecommended = getMissingFields(org, RECOMMENDED);
      if (missingRecommended.length > 0) {
        warnings.push(`consider adding ${missingRecommended.join(', ')}`);
      }
    }

    if (warnings.length > 0) {
      return warn('structured-data-organization', `Organization schema valid with suggestions`, {
        orgCount: orgs.length,
        warnings,
      });
    }

    return pass('structured-data-organization', `${orgs.length} Organization schema(s) properly configured`, {
      orgCount: orgs.length,
    });
  },
});
```

---

### Task 7: Create Product Schema Rule

**File:** `src/rules/structured-data/product.ts`

Validates Product schema for e-commerce.

```typescript
import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, fail } from '../define-rule.js';
import { findItemsByType, getMissingFields, hasField } from './utils.js';

const REQUIRED = ['name', 'image'];
const RECOMMENDED = ['description', 'brand', 'sku', 'gtin', 'aggregateRating', 'review'];
const OFFER_REQUIRED = ['price', 'priceCurrency', 'availability'];

export const structuredDataProductRule = defineRule({
  id: 'structured-data-product',
  name: 'Product Schema',
  description: 'Validates Product schema for e-commerce rich results',
  category: 'structured-data',
  weight: 12,
  run: (context: AuditContext) => {
    const { $ } = context;
    const products = findItemsByType($, ['Product', 'ProductGroup']);

    if (products.length === 0) {
      return pass('structured-data-product', 'No Product schema found (not required)', {
        found: false,
      });
    }

    const issues: string[] = [];
    const warnings: string[] = [];

    for (const product of products) {
      const missing = getMissingFields(product, REQUIRED);
      if (missing.length > 0) {
        issues.push(`Product missing: ${missing.join(', ')}`);
      }

      // Validate offers
      if (hasField(product, 'offers')) {
        const offers = product.data.offers;
        const offerList = Array.isArray(offers) ? offers : [offers];

        for (const offer of offerList) {
          if (typeof offer !== 'object' || offer === null) continue;
          const o = offer as Record<string, unknown>;

          for (const field of OFFER_REQUIRED) {
            if (!o[field]) {
              issues.push(`Offer missing ${field}`);
            }
          }

          // Check valid availability values
          if (o.availability) {
            const validAvailability = [
              'InStock', 'OutOfStock', 'PreOrder', 'BackOrder',
              'https://schema.org/InStock', 'https://schema.org/OutOfStock',
            ];
            const avail = o.availability as string;
            if (!validAvailability.some((v) => avail.includes(v.replace('https://schema.org/', '')))) {
              warnings.push('availability should use schema.org ItemAvailability values');
            }
          }
        }
      } else {
        issues.push('Product missing offers (required for rich results)');
      }

      const missingRecommended = getMissingFields(product, RECOMMENDED);
      if (missingRecommended.length > 0) {
        warnings.push(`consider adding ${missingRecommended.join(', ')}`);
      }
    }

    if (issues.length > 0) {
      return fail('structured-data-product', issues.slice(0, 3).join('; '), {
        productCount: products.length,
        issues,
        warnings,
      });
    }

    if (warnings.length > 0) {
      return warn('structured-data-product', `Product schema valid with suggestions`, {
        productCount: products.length,
        warnings,
      });
    }

    return pass('structured-data-product', `${products.length} Product schema(s) properly configured`, {
      productCount: products.length,
    });
  },
});
```

---

### Task 8: Create Review Schema Rule

**File:** `src/rules/structured-data/review.ts`

Validates Review and AggregateRating schemas.

```typescript
import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, fail } from '../define-rule.js';
import { findItemsByType, hasField } from './utils.js';

export const structuredDataReviewRule = defineRule({
  id: 'structured-data-review',
  name: 'Review Schema',
  description: 'Validates Review and AggregateRating schema for star ratings',
  category: 'structured-data',
  weight: 10,
  run: (context: AuditContext) => {
    const { $ } = context;
    const reviews = findItemsByType($, 'Review');
    const aggregateRatings = findItemsByType($, 'AggregateRating');

    if (reviews.length === 0 && aggregateRatings.length === 0) {
      return pass('structured-data-review', 'No Review/AggregateRating schema found (not required)', {
        found: false,
      });
    }

    const issues: string[] = [];
    const warnings: string[] = [];

    // Validate Reviews
    for (const review of reviews) {
      if (!hasField(review, 'itemReviewed')) {
        issues.push('Review missing itemReviewed');
      }
      if (!hasField(review, 'author')) {
        issues.push('Review missing author');
      }
      if (!hasField(review, 'reviewRating')) {
        warnings.push('Review should include reviewRating');
      } else {
        const rating = review.data.reviewRating as Record<string, unknown>;
        if (!rating.ratingValue) {
          issues.push('reviewRating missing ratingValue');
        }
      }
    }

    // Validate AggregateRatings
    for (const agg of aggregateRatings) {
      if (!hasField(agg, 'ratingValue')) {
        issues.push('AggregateRating missing ratingValue');
      }
      if (!hasField(agg, 'reviewCount') && !hasField(agg, 'ratingCount')) {
        issues.push('AggregateRating should have reviewCount or ratingCount');
      }
      if (!hasField(agg, 'bestRating')) {
        warnings.push('AggregateRating should specify bestRating (default 5)');
      }
    }

    if (issues.length > 0) {
      return fail('structured-data-review', issues.slice(0, 3).join('; '), {
        reviewCount: reviews.length,
        aggregateRatingCount: aggregateRatings.length,
        issues,
        warnings,
      });
    }

    if (warnings.length > 0) {
      return warn('structured-data-review', `Review schema valid with suggestions`, {
        reviewCount: reviews.length,
        aggregateRatingCount: aggregateRatings.length,
        warnings,
      });
    }

    return pass('structured-data-review', `Review/Rating schema properly configured`, {
      reviewCount: reviews.length,
      aggregateRatingCount: aggregateRatings.length,
    });
  },
});
```

---

### Task 9: Create Video Schema Rule

**File:** `src/rules/structured-data/video.ts`

Validates VideoObject schema for video content.

```typescript
import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, fail } from '../define-rule.js';
import { findItemsByType, getMissingFields, hasField } from './utils.js';

const REQUIRED = ['name', 'thumbnailUrl', 'uploadDate'];
const RECOMMENDED = ['description', 'contentUrl', 'duration', 'embedUrl', 'interactionStatistic'];

export const structuredDataVideoRule = defineRule({
  id: 'structured-data-video',
  name: 'Video Schema',
  description: 'Validates VideoObject schema for video rich results',
  category: 'structured-data',
  weight: 10,
  run: (context: AuditContext) => {
    const { $ } = context;
    const videos = findItemsByType($, 'VideoObject');

    if (videos.length === 0) {
      return pass('structured-data-video', 'No VideoObject schema found (not required)', {
        found: false,
      });
    }

    const issues: string[] = [];
    const warnings: string[] = [];

    for (const video of videos) {
      const missing = getMissingFields(video, REQUIRED);
      if (missing.length > 0) {
        issues.push(`VideoObject missing: ${missing.join(', ')}`);
      }

      // Validate thumbnailUrl is absolute
      if (hasField(video, 'thumbnailUrl')) {
        const thumb = video.data.thumbnailUrl as string;
        if (typeof thumb === 'string' && !thumb.startsWith('http')) {
          warnings.push('thumbnailUrl should be absolute URL');
        }
      }

      // Check duration format (ISO 8601)
      if (hasField(video, 'duration')) {
        const dur = video.data.duration as string;
        if (typeof dur === 'string' && !dur.startsWith('PT')) {
          warnings.push('duration should be ISO 8601 format (e.g., PT1M30S)');
        }
      }

      // Check uploadDate format
      if (hasField(video, 'uploadDate')) {
        const date = video.data.uploadDate as string;
        if (typeof date === 'string' && !date.match(/^\d{4}-\d{2}-\d{2}/)) {
          warnings.push('uploadDate should be ISO 8601 date format');
        }
      }

      const missingRecommended = getMissingFields(video, RECOMMENDED);
      if (missingRecommended.length > 0) {
        warnings.push(`consider adding ${missingRecommended.join(', ')}`);
      }
    }

    if (issues.length > 0) {
      return fail('structured-data-video', issues.join('; '), {
        videoCount: videos.length,
        issues,
        warnings,
      });
    }

    if (warnings.length > 0) {
      return warn('structured-data-video', `VideoObject valid with suggestions`, {
        videoCount: videos.length,
        warnings,
      });
    }

    return pass('structured-data-video', `${videos.length} VideoObject schema(s) properly configured`, {
      videoCount: videos.length,
    });
  },
});
```

---

### Task 10: Create WebSite Search Schema Rule

**File:** `src/rules/structured-data/website-search.ts`

Checks for WebSite schema with sitelinks searchbox.

```typescript
import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn } from '../define-rule.js';
import { findItemsByType, hasField } from './utils.js';

export const structuredDataWebsiteSearchRule = defineRule({
  id: 'structured-data-website-search',
  name: 'WebSite Search Schema',
  description: 'Checks for WebSite schema with sitelinks searchbox eligibility',
  category: 'structured-data',
  weight: 8,
  run: (context: AuditContext) => {
    const { $, url } = context;

    // Only relevant for homepage
    const urlObj = new URL(url);
    const isHomepage = urlObj.pathname === '/' || urlObj.pathname === '';

    const websites = findItemsByType($, 'WebSite');

    if (websites.length === 0) {
      if (isHomepage) {
        return warn('structured-data-website-search', 'Homepage missing WebSite schema', {
          isHomepage: true,
          suggestion: 'Add WebSite schema to enable sitelinks searchbox',
        });
      }
      return pass('structured-data-website-search', 'Non-homepage - WebSite schema not required here', {
        isHomepage: false,
      });
    }

    const issues: string[] = [];
    let hasSearchAction = false;

    for (const site of websites) {
      if (!hasField(site, 'name')) {
        issues.push('WebSite missing name');
      }
      if (!hasField(site, 'url')) {
        issues.push('WebSite missing url');
      }

      // Check for SearchAction
      if (hasField(site, 'potentialAction')) {
        const actions = site.data.potentialAction;
        const actionList = Array.isArray(actions) ? actions : [actions];

        for (const action of actionList) {
          if (typeof action !== 'object' || action === null) continue;
          const a = action as Record<string, unknown>;

          if (a['@type'] === 'SearchAction') {
            hasSearchAction = true;

            if (!a.target) {
              issues.push('SearchAction missing target');
            } else {
              // Target can be string or EntryPoint
              const target = a.target;
              if (typeof target === 'string' && !target.includes('{search_term_string}')) {
                issues.push('SearchAction target should include {search_term_string}');
              } else if (typeof target === 'object') {
                const t = target as Record<string, unknown>;
                const urlTemplate = t.urlTemplate as string;
                if (urlTemplate && !urlTemplate.includes('{search_term_string}')) {
                  issues.push('SearchAction urlTemplate should include {search_term_string}');
                }
              }
            }

            if (!a['query-input'] && !a.query) {
              issues.push('SearchAction missing query-input');
            }
          }
        }
      }
    }

    if (issues.length > 0) {
      return warn('structured-data-website-search', issues.join('; '), {
        websiteCount: websites.length,
        hasSearchAction,
        issues,
      });
    }

    if (!hasSearchAction) {
      return warn('structured-data-website-search', 'WebSite found but no SearchAction for sitelinks searchbox', {
        websiteCount: websites.length,
        hasSearchAction: false,
        suggestion: 'Add potentialAction with SearchAction for sitelinks searchbox eligibility',
      });
    }

    return pass('structured-data-website-search', 'WebSite schema with SearchAction properly configured', {
      websiteCount: websites.length,
      hasSearchAction: true,
    });
  },
});
```

---

### Task 11: Update Index and Required Fields

**File:** `src/rules/structured-data/index.ts`

Import and register all 9 new rules:

```typescript
import { registerRule } from '../registry.js';

import { structuredDataPresentRule } from './present.js';
import { structuredDataValidRule } from './valid.js';
import { structuredDataTypeRule } from './type.js';
import { structuredDataRequiredFieldsRule } from './required-fields.js';
import { structuredDataArticleRule } from './article.js';
import { structuredDataBreadcrumbRule } from './breadcrumb.js';
import { structuredDataFaqRule } from './faq.js';
import { structuredDataLocalBusinessRule } from './local-business.js';
import { structuredDataOrganizationRule } from './organization.js';
import { structuredDataProductRule } from './product.js';
import { structuredDataReviewRule } from './review.js';
import { structuredDataVideoRule } from './video.js';
import { structuredDataWebsiteSearchRule } from './website-search.js';

// Export all rules
export {
  structuredDataPresentRule,
  structuredDataValidRule,
  structuredDataTypeRule,
  structuredDataRequiredFieldsRule,
  structuredDataArticleRule,
  structuredDataBreadcrumbRule,
  structuredDataFaqRule,
  structuredDataLocalBusinessRule,
  structuredDataOrganizationRule,
  structuredDataProductRule,
  structuredDataReviewRule,
  structuredDataVideoRule,
  structuredDataWebsiteSearchRule,
};

// Register all rules
registerRule(structuredDataPresentRule);
registerRule(structuredDataValidRule);
registerRule(structuredDataTypeRule);
registerRule(structuredDataRequiredFieldsRule);
registerRule(structuredDataArticleRule);
registerRule(structuredDataBreadcrumbRule);
registerRule(structuredDataFaqRule);
registerRule(structuredDataLocalBusinessRule);
registerRule(structuredDataOrganizationRule);
registerRule(structuredDataProductRule);
registerRule(structuredDataReviewRule);
registerRule(structuredDataVideoRule);
registerRule(structuredDataWebsiteSearchRule);
```

**File:** `src/rules/structured-data/required-fields.ts`

Update to use shared utilities (import from utils.ts):

```typescript
// Add at top:
import { extractJsonLdScripts, extractTypedItems } from './utils.js';

// Remove the local extractTypedItems function (moved to utils.ts)
```

---

### Task 12: Update Fix Suggestions

**File:** `src/reporters/fix-suggestions.ts`

Add fix suggestions for all 9 new rules:

```typescript
// ============ Structured Data (Type-Specific) ============
'structured-data-article': 'Add Article schema with headline, author (Person/Organization), datePublished, and image',
'structured-data-breadcrumb': 'Add BreadcrumbList schema with itemListElement array for navigation hierarchy',
'structured-data-faq': 'Add FAQPage schema with mainEntity array of Question items with acceptedAnswer',
'structured-data-local-business': 'Add LocalBusiness schema with name, address (PostalAddress), telephone, and geo coordinates',
'structured-data-organization': 'Add Organization schema with name, logo, url, and sameAs for social profiles',
'structured-data-product': 'Add Product schema with name, image, offers (price, priceCurrency, availability)',
'structured-data-review': 'Add Review schema with itemReviewed, author, reviewRating; or AggregateRating with ratingValue, reviewCount',
'structured-data-video': 'Add VideoObject schema with name, thumbnailUrl, uploadDate, and description',
'structured-data-website-search': 'Add WebSite schema with potentialAction SearchAction for sitelinks searchbox',
```

---

### Task 13: Update Documentation

**File:** `CLAUDE.md`

Update rule counts:
- Total rules: 81 → 90
- Structured Data: 4 → 13 rules (6% weight)

Add to Common Fixes:
```markdown
### Structured Data
| Issue | Fix |
|-------|-----|
| Missing Article schema | Add headline, author, datePublished, image |
| Missing Breadcrumb | Add BreadcrumbList on non-homepage pages |
| Invalid FAQPage | Ensure mainEntity has Question items with acceptedAnswer |
| Missing LocalBusiness | Add name, address, telephone, geo for local SEO |
| Missing Organization | Add name, logo, sameAs for brand presence |
| Invalid Product | Add offers with price, priceCurrency, availability |
| Invalid Review | Add itemReviewed, author, reviewRating |
| Missing VideoObject | Add name, thumbnailUrl, uploadDate |
| No sitelinks searchbox | Add WebSite with SearchAction on homepage |
```

**File:** `README.md`

Update rule counts in Features section and Categories table.

**File:** `docs/SEO-AUDIT-RULES.md`

Add documentation for all 9 new rules in Structured Data section.

---

## Verification

```bash
# Build
npm run build

# Test new rules on sites with structured data
./dist/cli.js audit https://www.amazon.com --categories structured-data --no-cwv
./dist/cli.js audit https://www.bbc.com --categories structured-data --no-cwv
./dist/cli.js audit https://www.youtube.com --categories structured-data --no-cwv

# Verify 13 structured data rules
./dist/cli.js audit https://example.com --format llm --no-cwv 2>/dev/null | grep -c 'rule="structured-data-'

# Run tests
npm run test:run
```

---

## Notes

- Type-specific rules use `pass` when schema not present (not required for all pages)
- `warn` severity for info-level rules (breadcrumb, organization, website-search)
- `fail` severity for missing required fields (article, faq, product, review, video)
- Weights adjusted to distribute 100 points across 13 rules
- Shared utilities in `utils.ts` prevent code duplication
