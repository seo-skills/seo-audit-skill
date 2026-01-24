# Images Rules Expansion Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add 5 new image audit rules to match SquirrelScan's comprehensive image analysis, expanding SEOmator from 7 to 12 images rules (76→81 total rules).

**Architecture:** Extend the existing images rules module with new detection capabilities. Requires minor updates to `types.ts` and `fetcher.ts` to extract figure, inline SVG, and picture element data.

**Tech Stack:** TypeScript, Cheerio for DOM parsing, existing fetcher for HTTP checks

---

## New Rules Summary

| # | Rule | ID | Severity | Complexity |
|---|------|----|----------|------------|
| 1 | Broken Images | `images-broken` | fail | Medium (HTTP) |
| 2 | Figure Captions | `images-figure-captions` | info | Easy |
| 3 | Image Filename Quality | `images-filename-quality` | warn | Easy |
| 4 | Inline SVG Size | `images-inline-svg-size` | warn | Easy |
| 5 | Picture Element Validation | `images-picture-element` | fail | Easy |

---

## Files to Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/types.ts` | MODIFY | Add `FigureInfo`, `InlineSvgInfo`, `PictureElementInfo` types |
| `src/crawler/fetcher.ts` | MODIFY | Extract figures, inline SVGs, picture elements |
| `src/rules/images/broken.ts` | CREATE | Check images returning 404 |
| `src/rules/images/figure-captions.ts` | CREATE | Check figure/figcaption usage |
| `src/rules/images/filename-quality.ts` | CREATE | Check for descriptive filenames |
| `src/rules/images/inline-svg-size.ts` | CREATE | Check for large inline SVGs |
| `src/rules/images/picture-element.ts` | CREATE | Validate picture has img fallback |
| `src/rules/images/index.ts` | MODIFY | Register new rules |
| `src/reporters/fix-suggestions.ts` | MODIFY | Add fix suggestions |
| `docs/SEO-AUDIT-RULES.md` | MODIFY | Document new rules |
| `README.md` | MODIFY | Update rule counts |
| `CLAUDE.md` | MODIFY | Update rule count (76→81) |

---

## Implementation Tasks

### Task 1: Update Types

**File:** `src/types.ts`

Add after `SpecialLinkInfo`:

```typescript
/**
 * Figure element information
 */
export interface FigureInfo {
  /** Whether figure has a figcaption */
  hasFigcaption: boolean;
  /** Number of images inside the figure */
  imageCount: number;
  /** The figcaption text (if present) */
  captionText?: string;
}

/**
 * Inline SVG information
 */
export interface InlineSvgInfo {
  /** Size in bytes of the SVG markup */
  sizeBytes: number;
  /** Whether SVG has viewBox attribute */
  hasViewBox: boolean;
  /** Whether SVG has title element */
  hasTitle: boolean;
  /** Snippet of SVG for identification (first 100 chars) */
  snippet: string;
}

/**
 * Picture element information
 */
export interface PictureElementInfo {
  /** Whether picture has an img fallback */
  hasImgFallback: boolean;
  /** Number of source elements */
  sourceCount: number;
  /** The img src if present */
  imgSrc?: string;
  /** Source types defined (e.g., ['image/webp', 'image/avif']) */
  sourceTypes: string[];
}
```

Add to `AuditContext`:
```typescript
/** Figure elements on the page */
figures: FigureInfo[];
/** Inline SVG elements */
inlineSvgs: InlineSvgInfo[];
/** Picture elements */
pictureElements: PictureElementInfo[];
```

---

### Task 2: Update Fetcher

**File:** `src/crawler/fetcher.ts`

**2.1** Add `extractFigures` function:
```typescript
function extractFigures($: CheerioAPI): FigureInfo[] {
  const figures: FigureInfo[] = [];

  $('figure').each((_, element) => {
    const $el = $(element);
    const $figcaption = $el.find('figcaption');

    figures.push({
      hasFigcaption: $figcaption.length > 0,
      imageCount: $el.find('img').length,
      captionText: $figcaption.text().trim().slice(0, 200) || undefined,
    });
  });

  return figures;
}
```

**2.2** Add `extractInlineSvgs` function:
```typescript
function extractInlineSvgs($: CheerioAPI): InlineSvgInfo[] {
  const svgs: InlineSvgInfo[] = [];

  $('svg').each((_, element) => {
    const $el = $(element);
    const html = $.html($el);

    svgs.push({
      sizeBytes: Buffer.byteLength(html, 'utf8'),
      hasViewBox: $el.attr('viewBox') !== undefined,
      hasTitle: $el.find('title').length > 0,
      snippet: html.slice(0, 100),
    });
  });

  return svgs;
}
```

**2.3** Add `extractPictureElements` function:
```typescript
function extractPictureElements($: CheerioAPI): PictureElementInfo[] {
  const pictures: PictureElementInfo[] = [];

  $('picture').each((_, element) => {
    const $el = $(element);
    const $img = $el.find('img');
    const $sources = $el.find('source');

    const sourceTypes: string[] = [];
    $sources.each((_, source) => {
      const type = $(source).attr('type');
      if (type) sourceTypes.push(type);
    });

    pictures.push({
      hasImgFallback: $img.length > 0,
      sourceCount: $sources.length,
      imgSrc: $img.attr('src'),
      sourceTypes,
    });
  });

  return pictures;
}
```

**2.4** Update `createAuditContext` to include new fields:
```typescript
return {
  // ... existing fields
  figures: extractFigures($),
  inlineSvgs: extractInlineSvgs($),
  pictureElements: extractPictureElements($),
};
```

---

### Task 3: Create Rule Files

**3.1 Broken Images** (`broken.ts`)

```typescript
import type { AuditContext } from '../../types.js';
import { defineRule, pass, fail, warn } from '../define-rule.js';
import { fetchUrl } from '../../crawler/fetcher.js';

const MAX_IMAGES_TO_CHECK = 20;

export const brokenRule = defineRule({
  id: 'images-broken',
  name: 'No Broken Images',
  description: 'Checks that all images are accessible (no 404 errors)',
  category: 'images',
  weight: 15,
  run: async (context: AuditContext) => {
    const { images } = context;

    if (images.length === 0) {
      return pass('images-broken', 'No images found on page', { imageCount: 0 });
    }

    // Limit check to first N images for performance
    const imagesToCheck = images.slice(0, MAX_IMAGES_TO_CHECK);
    const brokenImages: Array<{ src: string; status: number }> = [];

    await Promise.all(
      imagesToCheck.map(async (img) => {
        try {
          const status = await fetchUrl(img.src, 5000);
          if (status === 404 || status === 410) {
            brokenImages.push({ src: img.src, status });
          }
        } catch {
          // Skip on network errors
        }
      })
    );

    if (brokenImages.length > 0) {
      return fail(
        'images-broken',
        `Found ${brokenImages.length} broken image(s) (404/410 errors)`,
        {
          brokenCount: brokenImages.length,
          checkedCount: imagesToCheck.length,
          totalImages: images.length,
          brokenImages: brokenImages.slice(0, 10),
          suggestion: 'Fix or remove broken image references',
        }
      );
    }

    return pass(
      'images-broken',
      `All ${imagesToCheck.length} checked image(s) are accessible`,
      {
        checkedCount: imagesToCheck.length,
        totalImages: images.length,
        note: images.length > MAX_IMAGES_TO_CHECK
          ? `Only first ${MAX_IMAGES_TO_CHECK} images were checked`
          : undefined,
      }
    );
  },
});
```

**3.2 Figure Captions** (`figure-captions.ts`)

```typescript
import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn } from '../define-rule.js';

export const figureCaptionsRule = defineRule({
  id: 'images-figure-captions',
  name: 'Figure Captions',
  description: 'Checks for proper use of figure and figcaption elements',
  category: 'images',
  weight: 5,
  run: (context: AuditContext) => {
    const { figures } = context;

    if (figures.length === 0) {
      return pass(
        'images-figure-captions',
        'No figure elements found on page',
        { figureCount: 0 }
      );
    }

    const withoutCaptions = figures.filter((f) => !f.hasFigcaption);
    const emptyFigures = figures.filter((f) => f.imageCount === 0);

    const issues: string[] = [];
    if (withoutCaptions.length > 0) {
      issues.push(`${withoutCaptions.length} figure(s) missing figcaption`);
    }
    if (emptyFigures.length > 0) {
      issues.push(`${emptyFigures.length} figure(s) without images`);
    }

    if (issues.length > 0) {
      return warn(
        'images-figure-captions',
        issues.join('; '),
        {
          totalFigures: figures.length,
          withoutCaptions: withoutCaptions.length,
          emptyFigures: emptyFigures.length,
          suggestion: 'Add figcaption elements to describe figure content for accessibility',
        }
      );
    }

    return pass(
      'images-figure-captions',
      `All ${figures.length} figure element(s) have proper figcaption`,
      { totalFigures: figures.length }
    );
  },
});
```

**3.3 Image Filename Quality** (`filename-quality.ts`)

```typescript
import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn } from '../define-rule.js';

/**
 * Patterns that indicate poor filename quality
 */
const BAD_FILENAME_PATTERNS = [
  /^IMG[_-]?\d+/i,           // IMG_001, IMG-001
  /^DSC[_-]?\d+/i,           // DSC_001 (camera default)
  /^DCIM[_-]?\d+/i,          // DCIM folder naming
  /^image\d*\.(jpg|png|gif|webp)/i,  // image.jpg, image1.jpg
  /^photo\d*\.(jpg|png|gif|webp)/i,  // photo.jpg
  /^screenshot[_-]?\d*/i,    // screenshot, screenshot_1
  /^untitled/i,              // untitled
  /^unnamed/i,               // unnamed
  /^\d+\.(jpg|png|gif|webp)/i,  // 12345.jpg
  /^[a-f0-9]{32}\./i,        // MD5 hash filenames
  /^[a-f0-9-]{36}\./i,       // UUID filenames
];

function getFilename(src: string): string {
  try {
    const url = new URL(src);
    const path = url.pathname;
    return path.split('/').pop() || '';
  } catch {
    return src.split('/').pop() || '';
  }
}

function hasDescriptiveFilename(filename: string): { isGood: boolean; issue?: string } {
  if (!filename) {
    return { isGood: false, issue: 'Empty filename' };
  }

  for (const pattern of BAD_FILENAME_PATTERNS) {
    if (pattern.test(filename)) {
      return { isGood: false, issue: 'Non-descriptive filename pattern' };
    }
  }

  // Check if filename is too short (excluding extension)
  const nameWithoutExt = filename.replace(/\.[^.]+$/, '');
  if (nameWithoutExt.length < 3) {
    return { isGood: false, issue: 'Filename too short' };
  }

  return { isGood: true };
}

export const filenameQualityRule = defineRule({
  id: 'images-filename-quality',
  name: 'Image Filename Quality',
  description: 'Checks for descriptive image filenames (not IMG_001.jpg)',
  category: 'images',
  weight: 5,
  run: (context: AuditContext) => {
    const { images } = context;

    if (images.length === 0) {
      return pass(
        'images-filename-quality',
        'No images found on page',
        { imageCount: 0 }
      );
    }

    const poorFilenames: Array<{ src: string; filename: string; issue: string }> = [];

    for (const img of images) {
      const filename = getFilename(img.src);
      const { isGood, issue } = hasDescriptiveFilename(filename);

      if (!isGood && issue) {
        poorFilenames.push({ src: img.src, filename, issue });
      }
    }

    if (poorFilenames.length > 0) {
      const percentage = ((poorFilenames.length / images.length) * 100).toFixed(1);
      return warn(
        'images-filename-quality',
        `Found ${poorFilenames.length} image(s) with non-descriptive filenames (${percentage}%)`,
        {
          poorFilenameCount: poorFilenames.length,
          totalImages: images.length,
          images: poorFilenames.slice(0, 10),
          suggestion: 'Use descriptive filenames like "red-running-shoes.jpg" instead of "IMG_001.jpg"',
        }
      );
    }

    return pass(
      'images-filename-quality',
      `All ${images.length} image(s) have descriptive filenames`,
      { totalImages: images.length }
    );
  },
});
```

**3.4 Inline SVG Size** (`inline-svg-size.ts`)

```typescript
import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn } from '../define-rule.js';

/**
 * Maximum recommended inline SVG size in bytes (5KB)
 * Larger SVGs should be external files for caching
 */
const MAX_INLINE_SVG_BYTES = 5 * 1024;

export const inlineSvgSizeRule = defineRule({
  id: 'images-inline-svg-size',
  name: 'Inline SVG Size',
  description: 'Checks for large inline SVGs that bloat HTML (>5KB should be external)',
  category: 'images',
  weight: 5,
  run: (context: AuditContext) => {
    const { inlineSvgs } = context;

    if (inlineSvgs.length === 0) {
      return pass(
        'images-inline-svg-size',
        'No inline SVGs found on page',
        { svgCount: 0 }
      );
    }

    const largeSvgs = inlineSvgs.filter((svg) => svg.sizeBytes > MAX_INLINE_SVG_BYTES);
    const totalSvgBytes = inlineSvgs.reduce((sum, svg) => sum + svg.sizeBytes, 0);

    if (largeSvgs.length > 0) {
      const totalLargeBytes = largeSvgs.reduce((sum, svg) => sum + svg.sizeBytes, 0);
      return warn(
        'images-inline-svg-size',
        `Found ${largeSvgs.length} large inline SVG(s) (>${MAX_INLINE_SVG_BYTES / 1024}KB each, ${(totalLargeBytes / 1024).toFixed(1)}KB total)`,
        {
          largeSvgCount: largeSvgs.length,
          totalSvgCount: inlineSvgs.length,
          totalSvgBytesKB: (totalSvgBytes / 1024).toFixed(1),
          largeSvgs: largeSvgs.slice(0, 5).map((svg) => ({
            sizeKB: (svg.sizeBytes / 1024).toFixed(1),
            hasViewBox: svg.hasViewBox,
            snippet: svg.snippet,
          })),
          suggestion: 'Move large SVGs to external files for better caching and smaller HTML payload',
        }
      );
    }

    return pass(
      'images-inline-svg-size',
      `All ${inlineSvgs.length} inline SVG(s) are appropriately sized (${(totalSvgBytes / 1024).toFixed(1)}KB total)`,
      {
        svgCount: inlineSvgs.length,
        totalSizeKB: (totalSvgBytes / 1024).toFixed(1),
        maxRecommendedKB: MAX_INLINE_SVG_BYTES / 1024,
      }
    );
  },
});
```

**3.5 Picture Element Validation** (`picture-element.ts`)

```typescript
import type { AuditContext } from '../../types.js';
import { defineRule, pass, fail } from '../define-rule.js';

export const pictureElementRule = defineRule({
  id: 'images-picture-element',
  name: 'Picture Element Validation',
  description: 'Validates that picture elements have required img fallback',
  category: 'images',
  weight: 10,
  run: (context: AuditContext) => {
    const { pictureElements } = context;

    if (pictureElements.length === 0) {
      return pass(
        'images-picture-element',
        'No picture elements found on page',
        { pictureCount: 0 }
      );
    }

    const missingFallback = pictureElements.filter((p) => !p.hasImgFallback);
    const noSources = pictureElements.filter((p) => p.sourceCount === 0);

    const issues: string[] = [];
    if (missingFallback.length > 0) {
      issues.push(`${missingFallback.length} picture element(s) missing img fallback`);
    }
    if (noSources.length > 0) {
      issues.push(`${noSources.length} picture element(s) without source elements`);
    }

    if (missingFallback.length > 0) {
      return fail(
        'images-picture-element',
        issues.join('; '),
        {
          totalPictures: pictureElements.length,
          missingFallback: missingFallback.length,
          noSources: noSources.length,
          suggestion: 'Every <picture> element must contain an <img> element as fallback for browsers that do not support picture',
        }
      );
    }

    if (noSources.length > 0) {
      return fail(
        'images-picture-element',
        issues.join('; '),
        {
          totalPictures: pictureElements.length,
          noSources: noSources.length,
          suggestion: 'Add <source> elements inside <picture> to provide alternative image formats',
        }
      );
    }

    // Check for modern format usage
    const withModernFormats = pictureElements.filter((p) =>
      p.sourceTypes.some((t) => t.includes('webp') || t.includes('avif'))
    );

    return pass(
      'images-picture-element',
      `All ${pictureElements.length} picture element(s) are valid (${withModernFormats.length} use modern formats)`,
      {
        totalPictures: pictureElements.length,
        withModernFormats: withModernFormats.length,
        avgSourcesPerPicture: (
          pictureElements.reduce((sum, p) => sum + p.sourceCount, 0) / pictureElements.length
        ).toFixed(1),
      }
    );
  },
});
```

---

### Task 4: Update Index

**File:** `src/rules/images/index.ts`

Add imports:
```typescript
import { brokenRule } from './broken.js';
import { figureCaptionsRule } from './figure-captions.js';
import { filenameQualityRule } from './filename-quality.js';
import { inlineSvgSizeRule } from './inline-svg-size.js';
import { pictureElementRule } from './picture-element.js';
```

Add to exports:
```typescript
export {
  // ... existing exports
  brokenRule,
  figureCaptionsRule,
  filenameQualityRule,
  inlineSvgSizeRule,
  pictureElementRule,
};
```

Add registrations:
```typescript
registerRule(brokenRule);
registerRule(figureCaptionsRule);
registerRule(filenameQualityRule);
registerRule(inlineSvgSizeRule);
registerRule(pictureElementRule);
```

---

### Task 5: Update Fix Suggestions

**File:** `src/reporters/fix-suggestions.ts`

Add to `FIX_SUGGESTIONS`:
```typescript
// ============ Images (new) ============
'images-broken': 'Fix or remove broken image references (404 errors)',
'images-figure-captions': 'Add figcaption elements to describe figure content for accessibility',
'images-filename-quality': 'Use descriptive filenames like "red-running-shoes.jpg" instead of "IMG_001.jpg"',
'images-inline-svg-size': 'Move large SVGs (>5KB) to external files for better caching',
'images-picture-element': 'Ensure every <picture> element contains an <img> fallback element',
```

---

### Task 6: Update Documentation

**6.1 Update `docs/SEO-AUDIT-RULES.md`**

Update Images section to include all 12 rules.

**6.2 Update `README.md`**

- Update total rules: 76 → 81
- Update Images category: 7 → 12 rules

**6.3 Update `CLAUDE.md`**

- Update total rules: 76 → 81
- Update Images category count: 7 → 12

---

## Verification

```bash
# Build
npm run build

# Test new rules
./dist/cli.js audit https://example.com --format json --no-cwv | jq '.categoryResults[] | select(.categoryId == "images")'

# Verify 12 images rules are present
./dist/cli.js audit https://example.com --format llm --no-cwv 2>/dev/null | grep -c 'rule="images-'

# Run tests
npm run test:run
```

---

## Notes

- Broken images check is limited to 20 images per page for performance
- Inline SVG threshold is 5KB - larger should be external files
- Filename quality uses heuristics; may have false positives for CDN-generated names
- Picture element validation requires both `<img>` fallback and `<source>` elements
