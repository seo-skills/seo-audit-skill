# E-E-A-T Category Design

**Date:** 2026-01-26
**Status:** Approved

## Overview

Add a dedicated E-E-A-T (Experience, Expertise, Authority, Trust) category to SEOmator with 14 rules, mirroring SquirrelScan's implementation.

## Rules (14 total)

| Rule ID | Name | Source | Weight | Description |
|---------|------|--------|--------|-------------|
| `eeat-about-page` | About Page | NEW | 8 | Checks for /about or /about-us page |
| `eeat-affiliate-disclosure` | Affiliate Disclosure | NEW | 5 | Checks for affiliate/sponsored disclosures |
| `eeat-author-byline` | Author Bylines | MOVE | 8 | Checks for visible author names |
| `eeat-author-expertise` | Author Expertise | NEW | 8 | Checks for credentials, bio, social links |
| `eeat-citations` | Citations | NEW | 6 | Checks for authoritative external citations |
| `eeat-contact-page` | Contact Page | NEW | 8 | Checks for contact page with methods |
| `eeat-content-dates` | Content Dates | MOVE | 8 | Checks for published/modified dates |
| `eeat-disclaimers` | Disclaimers | NEW | 4 | Checks for disclaimers on YMYL content |
| `eeat-editorial-policy` | Editorial Policy | NEW | 4 | Checks for editorial policy pages |
| `eeat-physical-address` | Physical Address | NEW | 6 | Checks for visible business address |
| `eeat-privacy-policy` | Privacy Policy | MOVE | 8 | Checks for privacy policy in footer |
| `eeat-terms-of-service` | Terms of Service | MOVE | 6 | Checks for ToS page |
| `eeat-trust-signals` | Trust Signals | NEW | 6 | Checks for badges, certifications |
| `eeat-ymyl-detection` | YMYL Detection | NEW | 5 | Detects Your Money Your Life content |

**Moved rules:** 4 (from content and legal categories)
**New rules:** 10

## Weight Redistribution

| Category | Before | After | Change |
|----------|--------|-------|--------|
| Social | 4% | 3% | -1% |
| Content | 5% | 4% | -1% |
| Internationalization | 2% | 1% | -1% |
| Legal Compliance | 2% | 1% | -1% |
| **E-E-A-T** | — | **4%** | NEW |
| **Total** | 100% | 100% | ✓ |

## Rule Implementations

### `eeat-about-page`
- Scans internal links for `/about`, `/about-us`, `/company`, `/who-we-are`
- Checks for "About" link text in navigation/footer
- Pass if found, warn if missing

### `eeat-affiliate-disclosure`
- Looks for disclosure patterns: "affiliate", "sponsored", "commission", "paid partnership"
- Checks for FTC-compliant disclosure near affiliate links
- Pass if found (or no affiliate links), warn if affiliate links without disclosure

### `eeat-author-expertise`
- Checks author bio/description length (>50 chars)
- Looks for credentials: "MD", "PhD", "CPA", "years experience"
- Checks for author social links (LinkedIn, Twitter)
- Pass with signals found, warn if author exists but no expertise indicators

### `eeat-citations`
- Counts external links to authoritative domains (.gov, .edu, major publications)
- Checks for citation markup patterns (footnotes, references section)
- Pass if 2+ quality citations, info if fewer

### `eeat-contact-page`
- Scans for `/contact`, `/contact-us`, `/get-in-touch` links
- Checks for multiple contact methods (email, phone, form, address)
- Pass if contact page with 2+ methods, warn if missing

### `eeat-disclaimers`
- Detects YMYL content first (medical, financial, legal)
- If YMYL, checks for appropriate disclaimers
- Pass if disclaimer present (or not YMYL), warn if YMYL without disclaimer

### `eeat-editorial-policy`
- Scans for `/editorial-policy`, `/editorial-guidelines`, `/content-policy`
- Pass if found, info if missing

### `eeat-physical-address`
- Checks Schema.org for `PostalAddress`, `address` property
- Scans footer/contact for address patterns
- Pass if found, info if missing

### `eeat-trust-signals`
- Looks for trust badges: BBB, TrustPilot, security seals
- Checks for testimonials/reviews section
- Pass if 2+ signals, info if fewer

### `eeat-ymyl-detection`
- Detects YMYL content by keywords and patterns
- Categories: health/medical, financial, legal, safety, news
- Returns info status with detected categories

## File Structure

```
src/rules/eeat/
├── index.ts
├── about-page.ts
├── affiliate-disclosure.ts
├── author-byline.ts         # moved from content/author-info.ts
├── author-expertise.ts
├── citations.ts
├── contact-page.ts
├── content-dates.ts         # moved from content/freshness.ts
├── disclaimers.ts
├── editorial-policy.ts
├── physical-address.ts
├── privacy-policy.ts        # moved from legal/privacy-policy.ts
├── terms-of-service.ts      # moved from legal/terms-of-service.ts
├── trust-signals.ts
├── ymyl-detection.ts
└── eeat.test.ts
```

## Files to Modify

- `src/categories/index.ts` - Add E-E-A-T, update weights
- `src/rules/index.ts` - Import eeat rules
- `src/rules/content/index.ts` - Remove moved rules
- `src/rules/legal/index.ts` - Remove moved rules
- `CLAUDE.md` - Document E-E-A-T category

## Breaking Changes

Old rule IDs will no longer work:
- `content-author-info` → `eeat-author-byline`
- `content-freshness` → `eeat-content-dates`
- `legal-privacy-policy` → `eeat-privacy-policy`
- `legal-terms-of-service` → `eeat-terms-of-service`

Users must update their `seomator.toml` config files.

## Testing

~50 test cases covering:
- Each rule with pass/warn/info scenarios
- YMYL detection accuracy
- Schema.org parsing
- Link pattern matching
