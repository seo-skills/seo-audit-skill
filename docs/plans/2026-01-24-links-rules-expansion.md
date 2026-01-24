# Links Rules Expansion Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add 7 new links audit rules to match SquirrelScan's comprehensive link analysis.

**Architecture:** Extend the existing links rules module with new detection capabilities for dead-end pages, HTTPS downgrade, redirect chains, invalid links, orphan pages, tel/mailto validation, and external link counting.

**Tech Stack:** TypeScript, Cheerio for DOM parsing, native fetch for HTTP checks

---

## Summary

| Rule | ID | Severity | Complexity |
|------|----|----------|------------|
| Dead-End Pages | `links-dead-end-pages` | warn | Easy |
| HTTPS Downgrade | `links-https-downgrade` | warn | Easy |
| External Links Count | `links-external-count` | info | Easy |
| Invalid Links | `links-invalid` | warn | Medium |
| Tel & Mailto | `links-tel-mailto` | warn | Easy |
| Redirect Chains | `links-redirect-chains` | warn | Medium |
| Orphan Pages | `links-orphan-pages` | warn | Complex (crawl-only) |

---

## Task 1: Dead-End Pages Rule

**Files:**
- Create: `src/rules/links/dead-end-pages.ts`

Pages with no outgoing internal links trap users and crawlers.

```typescript
import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn } from '../define-rule.js';

/**
 * Rule: Check for pages with no outgoing internal links (dead ends)
 */
export const deadEndPagesRule = defineRule({
  id: 'links-dead-end-pages',
  name: 'No Dead-End Pages',
  description: 'Checks that pages have outgoing internal links for navigation',
  category: 'links',
  weight: 1,
  run: async (context: AuditContext) => {
    const { links, url } = context;

    // Get internal links (excluding self-references)
    const outgoingInternalLinks = links.filter((link) => {
      if (!link.isInternal) return false;
      try {
        const linkUrl = new URL(link.href);
        const currentUrl = new URL(url);
        linkUrl.hash = '';
        currentUrl.hash = '';
        return linkUrl.href !== currentUrl.href;
      } catch {
        return false;
      }
    });

    if (outgoingInternalLinks.length === 0) {
      return warn(
        'links-dead-end-pages',
        'This page has no outgoing internal links (dead-end page)',
        {
          outgoingLinkCount: 0,
          impact: 'Users and crawlers may get stuck on this page',
          recommendation: 'Add navigation links, related content links, or breadcrumbs',
        }
      );
    }

    return pass(
      'links-dead-end-pages',
      `Page has ${outgoingInternalLinks.length} outgoing internal link(s)`,
      { outgoingLinkCount: outgoingInternalLinks.length }
    );
  },
});
```

---

## Task 2: HTTPS Downgrade Rule

**Files:**
- Create: `src/rules/links/https-downgrade.ts`

Detect links from HTTPS pages to HTTP destinations (mixed content / security issue).

```typescript
import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn } from '../define-rule.js';

/**
 * Rule: Check for HTTPS to HTTP link downgrades
 */
export const httpsDowngradeRule = defineRule({
  id: 'links-https-downgrade',
  name: 'No HTTPS Downgrade',
  description: 'Checks that HTTPS pages do not link to HTTP destinations',
  category: 'links',
  weight: 1,
  run: async (context: AuditContext) => {
    const { links, url } = context;

    // Only check if current page is HTTPS
    const isHttps = url.startsWith('https://');
    if (!isHttps) {
      return pass(
        'links-https-downgrade',
        'Page is not served over HTTPS (check skipped)',
        { pageProtocol: 'http' }
      );
    }

    // Find links that downgrade to HTTP
    const httpLinks = links.filter((link) => {
      try {
        const linkUrl = new URL(link.href);
        return linkUrl.protocol === 'http:';
      } catch {
        return false;
      }
    });

    if (httpLinks.length > 0) {
      return warn(
        'links-https-downgrade',
        `Found ${httpLinks.length} link(s) that downgrade from HTTPS to HTTP`,
        {
          httpLinkCount: httpLinks.length,
          examples: httpLinks.slice(0, 5).map((l) => ({
            href: l.href,
            text: l.text.slice(0, 50),
          })),
          impact: 'HTTP links may trigger browser security warnings',
          recommendation: 'Update links to use HTTPS or remove insecure links',
        }
      );
    }

    return pass(
      'links-https-downgrade',
      'All links maintain HTTPS security',
      { totalLinksChecked: links.length }
    );
  },
});
```

---

## Task 3: External Links Count Rule

**Files:**
- Create: `src/rules/links/external-count.ts`

Reports on external link count (informational, warn if excessive).

```typescript
import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn } from '../define-rule.js';

/**
 * Rule: Report on external link count
 */
export const externalCountRule = defineRule({
  id: 'links-external-count',
  name: 'External Links Count',
  description: 'Reports the number of external links on the page',
  category: 'links',
  weight: 1,
  run: async (context: AuditContext) => {
    const { links } = context;
    const externalLinks = links.filter((link) => !link.isInternal);
    const count = externalLinks.length;

    // Warn if excessive external links (potential link farm signal)
    const MAX_EXTERNAL_LINKS = 100;

    if (count > MAX_EXTERNAL_LINKS) {
      return warn(
        'links-external-count',
        `Page has ${count} external links (excessive)`,
        {
          externalLinkCount: count,
          threshold: MAX_EXTERNAL_LINKS,
          uniqueDomains: [...new Set(externalLinks.map((l) => {
            try { return new URL(l.href).hostname; } catch { return 'unknown'; }
          }))].length,
          impact: 'Excessive external links may dilute PageRank and appear spammy',
          recommendation: 'Reduce external links to essential, high-quality resources',
        }
      );
    }

    // Get unique domains for info
    const domains = [...new Set(externalLinks.map((l) => {
      try { return new URL(l.href).hostname; } catch { return 'unknown'; }
    }))];

    return pass(
      'links-external-count',
      `Page has ${count} external link(s) to ${domains.length} domain(s)`,
      {
        externalLinkCount: count,
        uniqueDomains: domains.length,
        topDomains: domains.slice(0, 10),
      }
    );
  },
});
```

---

## Task 4: Invalid Links Rule

**Files:**
- Modify: `src/crawler/fetcher.ts` (capture invalid links)
- Modify: `src/types.ts` (add invalidLinks to AuditContext)
- Create: `src/rules/links/invalid-links.ts`

Detect malformed hrefs that browsers can't parse.

### Step 4.1: Update types.ts

Add `InvalidLinkInfo` type and `invalidLinks` to `AuditContext`:

```typescript
/**
 * Invalid link information
 */
export interface InvalidLinkInfo {
  /** Raw href value */
  href: string;
  /** Reason it's invalid */
  reason: string;
  /** Link text content */
  text: string;
}
```

Add to `AuditContext`:
```typescript
/** Invalid links found on the page */
invalidLinks: InvalidLinkInfo[];
```

### Step 4.2: Update fetcher.ts

Modify `extractLinks` to also capture invalid links:

```typescript
interface ExtractedLinks {
  valid: LinkInfo[];
  invalid: InvalidLinkInfo[];
}

function extractLinks($: CheerioAPI, baseUrl: string): ExtractedLinks {
  const valid: LinkInfo[] = [];
  const invalid: InvalidLinkInfo[] = [];
  const baseUrlObj = new URL(baseUrl);

  $('a[href]').each((_, element) => {
    const $el = $(element);
    const href = $el.attr('href') || '';
    const text = ($el.text().trim() || $el.attr('title') || '').slice(0, 200);

    // Check for empty href
    if (!href || href === '#' || href === '') {
      invalid.push({ href, reason: 'empty', text });
      return;
    }

    // Check for javascript: (non-functional links)
    if (/^javascript:/i.test(href)) {
      invalid.push({ href: href.slice(0, 50), reason: 'javascript', text });
      return;
    }

    // Skip mailto:, tel:, data: (these are handled separately)
    if (/^(mailto:|tel:|data:)/i.test(href)) {
      return;
    }

    try {
      // Resolve relative URLs
      const resolvedUrl = new URL(href, baseUrl);
      // ... rest of valid link processing
    } catch {
      // URL parsing failed - invalid format
      invalid.push({ href: href.slice(0, 100), reason: 'malformed', text });
    }
  });

  return { valid, invalid };
}
```

### Step 4.3: Create invalid-links.ts

```typescript
import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn } from '../define-rule.js';

/**
 * Rule: Check for invalid link formats
 */
export const invalidLinksRule = defineRule({
  id: 'links-invalid',
  name: 'No Invalid Links',
  description: 'Checks for malformed or non-functional link formats',
  category: 'links',
  weight: 1,
  run: async (context: AuditContext) => {
    const { invalidLinks } = context;

    if (!invalidLinks || invalidLinks.length === 0) {
      return pass(
        'links-invalid',
        'No invalid links found',
        { invalidLinkCount: 0 }
      );
    }

    // Group by reason
    const byReason = invalidLinks.reduce((acc, link) => {
      acc[link.reason] = (acc[link.reason] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return warn(
      'links-invalid',
      `Found ${invalidLinks.length} invalid link(s)`,
      {
        invalidLinkCount: invalidLinks.length,
        byReason,
        examples: invalidLinks.slice(0, 10).map((l) => ({
          href: l.href,
          reason: l.reason,
          text: l.text.slice(0, 30),
        })),
        impact: 'Invalid links break navigation and confuse crawlers',
        recommendation: 'Replace javascript: links with buttons, fix malformed URLs',
      }
    );
  },
});
```

---

## Task 5: Tel & Mailto Links Rule

**Files:**
- Modify: `src/crawler/fetcher.ts` (capture tel/mailto links)
- Modify: `src/types.ts` (add specialLinks to AuditContext)
- Create: `src/rules/links/tel-mailto.ts`

Validate tel: and mailto: link formats.

### Step 5.1: Update types.ts

```typescript
/**
 * Special protocol link (tel:, mailto:)
 */
export interface SpecialLinkInfo {
  /** Protocol type */
  type: 'tel' | 'mailto';
  /** Raw href value */
  href: string;
  /** Extracted value (phone number or email) */
  value: string;
  /** Link text content */
  text: string;
  /** Whether format is valid */
  isValid: boolean;
  /** Validation issue if invalid */
  issue?: string;
}
```

Add to `AuditContext`:
```typescript
/** Special protocol links (tel:, mailto:) */
specialLinks: SpecialLinkInfo[];
```

### Step 5.2: Update fetcher.ts

Add extraction for special links in `extractLinks`:

```typescript
function extractSpecialLinks($: CheerioAPI): SpecialLinkInfo[] {
  const specialLinks: SpecialLinkInfo[] = [];

  $('a[href]').each((_, element) => {
    const $el = $(element);
    const href = $el.attr('href') || '';
    const text = ($el.text().trim() || '').slice(0, 100);

    // Check for tel: links
    if (/^tel:/i.test(href)) {
      const value = href.replace(/^tel:/i, '').trim();
      // Valid: +1234567890, (123) 456-7890, etc.
      const isValid = /^[+]?[\d\s\-().]+$/.test(value) && value.replace(/\D/g, '').length >= 7;
      specialLinks.push({
        type: 'tel',
        href,
        value,
        text,
        isValid,
        issue: isValid ? undefined : 'Invalid phone number format',
      });
      return;
    }

    // Check for mailto: links
    if (/^mailto:/i.test(href)) {
      const value = href.replace(/^mailto:/i, '').split('?')[0].trim();
      // Basic email validation
      const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
      specialLinks.push({
        type: 'mailto',
        href,
        value,
        text,
        isValid,
        issue: isValid ? undefined : 'Invalid email format',
      });
    }
  });

  return specialLinks;
}
```

### Step 5.3: Create tel-mailto.ts

```typescript
import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn } from '../define-rule.js';

/**
 * Rule: Validate tel: and mailto: link formats
 */
export const telMailtoRule = defineRule({
  id: 'links-tel-mailto',
  name: 'Valid Tel & Mailto Links',
  description: 'Validates phone and email link formats',
  category: 'links',
  weight: 1,
  run: async (context: AuditContext) => {
    const { specialLinks } = context;

    if (!specialLinks || specialLinks.length === 0) {
      return pass(
        'links-tel-mailto',
        'No tel: or mailto: links found',
        { count: 0 }
      );
    }

    const invalidLinks = specialLinks.filter((l) => !l.isValid);
    const telLinks = specialLinks.filter((l) => l.type === 'tel');
    const mailtoLinks = specialLinks.filter((l) => l.type === 'mailto');

    if (invalidLinks.length > 0) {
      return warn(
        'links-tel-mailto',
        `Found ${invalidLinks.length} invalid tel/mailto link(s)`,
        {
          totalSpecialLinks: specialLinks.length,
          telCount: telLinks.length,
          mailtoCount: mailtoLinks.length,
          invalidCount: invalidLinks.length,
          invalidLinks: invalidLinks.slice(0, 5).map((l) => ({
            type: l.type,
            value: l.value,
            issue: l.issue,
          })),
          recommendation: 'Use E.164 format for phone (+1234567890), valid email for mailto',
        }
      );
    }

    return pass(
      'links-tel-mailto',
      `All ${specialLinks.length} tel/mailto link(s) are valid`,
      {
        telCount: telLinks.length,
        mailtoCount: mailtoLinks.length,
      }
    );
  },
});
```

---

## Task 6: Redirect Chains Rule

**Files:**
- Modify: `src/crawler/fetcher.ts` (add fetchUrlWithRedirects function)
- Create: `src/rules/links/redirect-chains.ts`

Detect links pointing to URLs that redirect.

### Step 6.1: Add redirect detection to fetcher.ts

```typescript
/**
 * Check URL for redirects without following them
 * @returns Object with final status, redirect count, and chain
 */
export async function fetchUrlWithRedirects(
  url: string,
  timeout = 10000,
  maxRedirects = 5
): Promise<{
  finalUrl: string;
  statusCode: number;
  redirectCount: number;
  chain: string[];
}> {
  const chain: string[] = [url];
  let currentUrl = url;
  let redirectCount = 0;
  let statusCode = 0;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    while (redirectCount < maxRedirects) {
      const response = await fetch(currentUrl, {
        method: 'HEAD',
        signal: controller.signal,
        headers: {
          'User-Agent': 'SEOmatorBot/1.0 (+https://github.com/seo-skills/seo-audit-skill)',
        },
        redirect: 'manual', // Don't auto-follow
      });

      statusCode = response.status;

      // Check for redirect status codes
      if ([301, 302, 303, 307, 308].includes(statusCode)) {
        const location = response.headers.get('location');
        if (!location) break;

        // Resolve relative redirects
        const nextUrl = new URL(location, currentUrl).href;
        chain.push(nextUrl);
        currentUrl = nextUrl;
        redirectCount++;
      } else {
        break; // Not a redirect, we're done
      }
    }
  } catch {
    statusCode = 0;
  } finally {
    clearTimeout(timeoutId);
  }

  return {
    finalUrl: currentUrl,
    statusCode,
    redirectCount,
    chain,
  };
}
```

### Step 6.2: Create redirect-chains.ts

```typescript
import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, fail } from '../define-rule.js';
import { fetchUrlWithRedirects } from '../../crawler/fetcher.js';

/**
 * Rule: Check for links pointing to redirecting URLs
 */
export const redirectChainsRule = defineRule({
  id: 'links-redirect-chains',
  name: 'No Redirect Chains',
  description: 'Checks that links do not point to URLs that redirect',
  category: 'links',
  weight: 1,
  run: async (context: AuditContext) => {
    const { links } = context;
    const internalLinks = links.filter((link) => link.isInternal);

    if (internalLinks.length === 0) {
      return pass(
        'links-redirect-chains',
        'No internal links to check',
        { totalLinks: 0 }
      );
    }

    // Check a sample of internal links (limit to 20 for performance)
    const linksToCheck = internalLinks.slice(0, 20);
    const redirectingLinks: Array<{
      href: string;
      redirectCount: number;
      finalUrl: string;
    }> = [];

    for (const link of linksToCheck) {
      try {
        const result = await fetchUrlWithRedirects(link.href);
        if (result.redirectCount > 0) {
          redirectingLinks.push({
            href: link.href,
            redirectCount: result.redirectCount,
            finalUrl: result.finalUrl,
          });
        }
      } catch {
        // Skip on error
      }
    }

    if (redirectingLinks.length === 0) {
      return pass(
        'links-redirect-chains',
        `Checked ${linksToCheck.length} internal link(s), none redirect`,
        { checkedCount: linksToCheck.length }
      );
    }

    // Check severity: warn for 1-2 hops, fail for 3+ hops
    const longChains = redirectingLinks.filter((l) => l.redirectCount >= 3);

    if (longChains.length > 0) {
      return fail(
        'links-redirect-chains',
        `Found ${longChains.length} link(s) with 3+ redirect hops`,
        {
          redirectingLinkCount: redirectingLinks.length,
          longChainCount: longChains.length,
          examples: longChains.slice(0, 5).map((l) => ({
            original: l.href,
            final: l.finalUrl,
            hops: l.redirectCount,
          })),
          impact: 'Long redirect chains waste crawl budget and slow page loads',
          recommendation: 'Update links to point directly to final destination URLs',
        }
      );
    }

    return warn(
      'links-redirect-chains',
      `Found ${redirectingLinks.length} link(s) that redirect`,
      {
        redirectingLinkCount: redirectingLinks.length,
        checkedCount: linksToCheck.length,
        examples: redirectingLinks.slice(0, 5).map((l) => ({
          original: l.href,
          final: l.finalUrl,
          hops: l.redirectCount,
        })),
        recommendation: 'Update links to point directly to final destination URLs',
      }
    );
  },
});
```

---

## Task 7: Orphan Pages Rule (Crawl-Mode Only)

**Files:**
- Create: `src/rules/links/orphan-pages.ts`

Detect pages with no incoming internal links. This rule requires crawl-mode data.

```typescript
import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn } from '../define-rule.js';

/**
 * Rule: Check if page is linked from other pages (orphan detection)
 *
 * Note: This rule is most useful in crawl mode where we have site-wide link data.
 * In single-page mode, we can only check if the page is self-referencing.
 */
export const orphanPagesRule = defineRule({
  id: 'links-orphan-pages',
  name: 'No Orphan Pages',
  description: 'Checks that pages are linked from other pages in the site',
  category: 'links',
  weight: 1,
  run: async (context: AuditContext) => {
    const { url, links } = context;

    // In single-page mode, we can check if any internal link points back to this page
    // This is a proxy for orphan detection

    // Check if this page links to itself (navigation, breadcrumbs, etc.)
    const selfLinks = links.filter((link) => {
      if (!link.isInternal) return false;
      try {
        const linkUrl = new URL(link.href);
        const currentUrl = new URL(url);
        // Normalize: remove hash and trailing slash
        linkUrl.hash = '';
        currentUrl.hash = '';
        const linkPath = linkUrl.pathname.replace(/\/$/, '') || '/';
        const currentPath = currentUrl.pathname.replace(/\/$/, '') || '/';
        return linkUrl.hostname === currentUrl.hostname && linkPath === currentPath;
      } catch {
        return false;
      }
    });

    // If we're in single-page mode, we can only provide limited info
    // For full orphan detection, we'd need crawl-wide link graph

    return pass(
      'links-orphan-pages',
      'Orphan page detection requires crawl mode for accurate results',
      {
        selfLinkCount: selfLinks.length,
        note: 'Run with --crawl flag for site-wide orphan page detection',
        singlePageMode: true,
      }
    );
  },
});
```

**Note:** Full orphan page detection requires modifying the Auditor to build a link graph across all crawled pages. This is tracked as a future enhancement.

---

## Task 8: Update Index and Register Rules

**Files:**
- Modify: `src/rules/links/index.ts`

```typescript
/**
 * Links Rules
 */

import { registerRule } from '../registry.js';

import { brokenInternalRule } from './broken-internal.js';
import { externalValidRule } from './external-valid.js';
import { internalPresentRule } from './internal-present.js';
import { nofollowAppropriateRule } from './nofollow-appropriate.js';
import { anchorTextRule } from './anchor-text.js';
import { depthRule } from './depth.js';
// New rules
import { deadEndPagesRule } from './dead-end-pages.js';
import { httpsDowngradeRule } from './https-downgrade.js';
import { externalCountRule } from './external-count.js';
import { invalidLinksRule } from './invalid-links.js';
import { telMailtoRule } from './tel-mailto.js';
import { redirectChainsRule } from './redirect-chains.js';
import { orphanPagesRule } from './orphan-pages.js';

// Export all rules
export {
  brokenInternalRule,
  externalValidRule,
  internalPresentRule,
  nofollowAppropriateRule,
  anchorTextRule,
  depthRule,
  // New
  deadEndPagesRule,
  httpsDowngradeRule,
  externalCountRule,
  invalidLinksRule,
  telMailtoRule,
  redirectChainsRule,
  orphanPagesRule,
};

// Register all rules
registerRule(brokenInternalRule);
registerRule(externalValidRule);
registerRule(internalPresentRule);
registerRule(nofollowAppropriateRule);
registerRule(anchorTextRule);
registerRule(depthRule);
// New
registerRule(deadEndPagesRule);
registerRule(httpsDowngradeRule);
registerRule(externalCountRule);
registerRule(invalidLinksRule);
registerRule(telMailtoRule);
registerRule(redirectChainsRule);
registerRule(orphanPagesRule);
```

---

## Task 9: Update Fix Suggestions

**Files:**
- Modify: `src/reporters/fix-suggestions.ts`

Add to Links section:

```typescript
// ============ Links (new rules) ============
'links-dead-end-pages': 'Add navigation links, related content, or breadcrumbs to avoid dead ends',
'links-https-downgrade': 'Update HTTP links to HTTPS or remove insecure external links',
'links-external-count': 'Reduce external links to essential, high-quality resources only',
'links-invalid': 'Replace javascript: links with buttons, fix malformed URLs',
'links-tel-mailto': 'Use E.164 format for phone (+1234567890), valid email for mailto',
'links-redirect-chains': 'Update links to point directly to final destination URLs',
'links-orphan-pages': 'Add internal links from other pages to improve discoverability',
```

---

## Task 10: Update Documentation

**Files:**
- Modify: `CLAUDE.md`

Update Links category rule count from 6 to 13:

```markdown
| Links | 10% | 13 |
```

Add new rules to Common Fixes:

```markdown
### Links (new)
| Issue | Fix |
|-------|-----|
| Dead-end page | Add navigation, breadcrumbs, or related links |
| HTTPS downgrade | Update HTTP links to HTTPS versions |
| Too many external links | Remove non-essential external links |
| Invalid links | Replace javascript: with buttons, fix malformed URLs |
| Invalid tel/mailto | Use E.164 phone format, valid email addresses |
| Redirect chains | Link directly to final destination URLs |
| Orphan page | Add internal links from other pages |
```

---

## Task 11: Build and Test

**Commands:**

```bash
# Build
npm run build

# Test new rules on example.com
./dist/cli.js audit https://example.com --format json --no-cwv | jq '.categoryResults[] | select(.categoryId == "links")'

# Verify all tests pass
npm run test:run

# Check rule count
./dist/cli.js audit https://example.com --format llm --no-cwv | grep -c "rule="
```

---

## Verification Checklist

- [ ] 7 new rule files created in `src/rules/links/`
- [ ] `types.ts` updated with `InvalidLinkInfo`, `SpecialLinkInfo`
- [ ] `fetcher.ts` updated to extract invalid links and special links
- [ ] `fetcher.ts` has `fetchUrlWithRedirects` function
- [ ] `index.ts` exports and registers all 13 links rules
- [ ] `fix-suggestions.ts` has entries for all new rules
- [ ] `CLAUDE.md` updated with new rule count and fixes
- [ ] Build succeeds: `npm run build`
- [ ] All tests pass: `npm run test:run`
- [ ] Audit runs without errors: `./dist/cli.js audit https://example.com --no-cwv`
