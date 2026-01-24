# Security Rules Expansion Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add 6 new security audit rules to match SquirrelScan's comprehensive security analysis, expanding SEOmator from 6 to 12 security rules (90 → 96 total rules).

**Architecture:** Extend the existing security rules module with new detection capabilities for external link security, leaked secrets, form HTTPS, mixed content, and additional security headers.

**Tech Stack:** TypeScript, Cheerio for DOM parsing, regex patterns for secret detection.

---

## New Rules Summary

| # | Rule | ID | Severity | Complexity |
|---|------|----|----------|------------|
| 1 | External Link Security | `security-external-links` | warn | Easy |
| 2 | Form HTTPS | `security-form-https` | warn | Easy |
| 3 | Mixed Content | `security-mixed-content` | fail | Medium |
| 4 | Permissions-Policy | `security-permissions-policy` | warn | Easy |
| 5 | Referrer-Policy | `security-referrer-policy` | warn | Easy |
| 6 | Leaked Secrets | `security-leaked-secrets` | fail | Complex |

---

## Files to Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/rules/security/external-links.ts` | CREATE | Check target="_blank" has noopener/noreferrer |
| `src/rules/security/form-https.ts` | CREATE | Check form actions use HTTPS |
| `src/rules/security/mixed-content.ts` | CREATE | Detect HTTP resources on HTTPS pages |
| `src/rules/security/permissions-policy.ts` | CREATE | Check Permissions-Policy header |
| `src/rules/security/referrer-policy.ts` | CREATE | Check Referrer-Policy header |
| `src/rules/security/leaked-secrets.ts` | CREATE | Detect exposed credentials/API keys |
| `src/rules/security/index.ts` | MODIFY | Register new rules |
| `src/reporters/fix-suggestions.ts` | MODIFY | Add fix suggestions |
| `CLAUDE.md` | MODIFY | Update rule count (90→96) |
| `README.md` | MODIFY | Update rule count |
| `docs/SEO-AUDIT-RULES.md` | MODIFY | Add new rule documentation |

---

## Implementation Tasks

### Task 1: External Link Security

**File:** `src/rules/security/external-links.ts`

Checks that external links with `target="_blank"` have `rel="noopener"` and optionally `noreferrer` for security and privacy.

**Why it matters:**
- `noopener` prevents the new page from accessing `window.opener` (security)
- `noreferrer` also prevents passing the referrer header (privacy)

**Implementation:**
- Find all `a[target="_blank"]` elements
- Skip internal links, javascript:, mailto:, tel:
- Check if rel contains noopener or noreferrer
- Warn if missing

---

### Task 2: Form HTTPS

**File:** `src/rules/security/form-https.ts`

Checks that form actions use HTTPS to protect submitted data.

**Implementation:**
- Find all form elements
- Check action attribute for explicit http:// URLs
- POST forms with insecure actions are critical (fail)
- GET forms with insecure actions are warnings

---

### Task 3: Mixed Content

**File:** `src/rules/security/mixed-content.ts`

Detects HTTP resources loaded on HTTPS pages.

**Check elements:**
- `script[src^="http://"]` - active (fail)
- `link[rel="stylesheet"][href^="http://"]` - active (fail)
- `img[src^="http://"]` - passive (warn)
- `iframe[src^="http://"]` - active (fail)
- `audio/video[src^="http://"]` - passive (warn)
- `object[data^="http://"]` - active (fail)
- `embed[src^="http://"]` - active (fail)

---

### Task 4: Permissions-Policy

**File:** `src/rules/security/permissions-policy.ts`

Checks for Permissions-Policy (formerly Feature-Policy) header.

**Implementation:**
- Check `permissions-policy` header
- Fall back to legacy `feature-policy` header
- Parse feature names from header value
- Warn if deprecated Feature-Policy used

---

### Task 5: Referrer-Policy

**File:** `src/rules/security/referrer-policy.ts`

Checks for Referrer-Policy header or meta tag.

**Valid values:**
- no-referrer
- no-referrer-when-downgrade
- origin
- origin-when-cross-origin
- same-origin
- strict-origin
- strict-origin-when-cross-origin
- unsafe-url (warn - leaks full URL)

---

### Task 6: Leaked Secrets

**File:** `src/rules/security/leaked-secrets.ts`

Detects exposed API keys, credentials, and secrets in HTML and inline JavaScript.

**Patterns to detect (25 key patterns):**
- AWS Access Key: `AKIA[0-9A-Z]{16}`
- Google API Key: `AIza[0-9A-Za-z_-]{35}`
- GitHub Token: `gh[pousr]_[A-Za-z0-9_]{36,}`
- Stripe Keys: `sk_live_*`, `pk_live_*`
- Slack Token: `xox[baprs]-*`
- Firebase, Twilio, SendGrid, Mailgun, etc.
- RSA/SSH Private Keys
- Generic patterns: password, api_key, client_secret

---

### Task 7: Update Index

**File:** `src/rules/security/index.ts`

Import and register all 6 new rules.

---

### Task 8: Update Fix Suggestions

**File:** `src/reporters/fix-suggestions.ts`

Add fix suggestions:
- external-links: Add rel="noopener noreferrer"
- form-https: Update form actions to HTTPS
- mixed-content: Replace HTTP with HTTPS resources
- permissions-policy: Add Permissions-Policy header
- referrer-policy: Add Referrer-Policy header
- leaked-secrets: Remove secrets, rotate credentials

---

### Task 9: Update Documentation

Update CLAUDE.md, README.md, docs/SEO-AUDIT-RULES.md:
- Total rules: 90 → 96
- Security category: 6 → 12 rules
- Add new rules to tables
- Add Common Fixes entries

---

## Verification

```bash
# Build
npm run build

# Test new rules
./dist/cli.js audit https://example.com --categories security --format json --no-cwv

# Run tests
npm run test:run
```
