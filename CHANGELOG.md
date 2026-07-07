# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Security

- LLM reporter now wraps all site-derived content (rule messages and details)
  in nonce-stamped `<untrusted-{nonce}>...</untrusted-{nonce}>` delimiters and
  emits a `<security-notice>` instructing the consuming LLM to treat those
  blocks as data only. Defends against indirect prompt injection from audited
  pages whose content reaches the report (e.g., a hostile `<title>` or meta
  description). The 128-bit per-report nonce prevents an attacker from forging
  a closing tag because they cannot predict it at audit time.
- LLM reporter now strips zero-width characters (U+200B–U+200D, U+2060,
  U+FEFF) and Unicode tag block characters (U+E0000–U+E007F) from quoted site
  content before XML escaping. The Unicode tag block is the dominant
  invisible-prompt-injection vector — characters render as zero pixels but
  carry hidden ASCII instructions LLMs will read.
- Removed `context7.json` from the repository. The file contained only a
  Context7 documentation-service public identifier (analogous to a Stripe
  publishable key — designed to ship in source) but tripped a credential
  scanner via `pk_<base62>` regex matching.

### Added

- `src/reporters/llm-reporter.test.ts` — covers the new security envelope:
  nonce uniqueness, security-notice presence, untrusted-block wrapping for
  messages and details, fix-suggestion exemption, zero-width and Unicode-tag
  character stripping, and closing-tag forgery defense via XML escaping.
- "Trust Model" section in `SKILL.md` documenting the layered defense applied
  to LLM-format output.

### Changed

- `references/rules.md` (and `skill/references/rules.md`) rewritten from the
  stale v1.2.2 rule set (55 rules / 9 categories, `meta-tags-*`/`headings-*`
  IDs) to the current v3.0.0 reference: all 20 categories with weights and
  rule counts, `<category>-<name>` ID convention, score grades, and CWV
  thresholds.

## [3.0.1] - 2026-05-06

### Fixed

- Republished `dist/index.js` so the programmatic entry point
  (`import { createAuditor } from '@seomator/seo-audit'`) works on npm. The
  source was correct, but the `3.0.0` tarball was missing the library build
  artifact, causing programmatic consumers to receive an undefined export.

### Added

- Integration test suite for the programmatic API (`src/auditor.test.ts`).
  Covers `createAuditor` / `Auditor` exports, default-vs-filtered category
  selection, the `AuditResult` shape returned by `audit()`, lifecycle callback
  ordering (`onCategoryStart` → `onRuleComplete*` → `onCategoryComplete`), and
  the single-fetch invariant. Imports through `./index.js` to mirror the npm
  consumer entry point and catch packaging regressions like the one reported
  against the published `3.0.0` artifact.
