#!/usr/bin/env node
/**
 * Sync the rule/category counts and version strings in the docs with the live
 * registry.
 *
 * The CLI derives everything it prints — `getVersion()` for the version,
 * `getRuleCount()` for the count — so the code cannot drift. The prose could,
 * and did: at the time this was written the same repository claimed 251 rules
 * (published dist), 261 (README section heading), 287 (skill clone), and 316
 * (every other doc), while the registry held 320.
 *
 * Usage:
 *   node scripts/sync-docs.mjs            rewrite the docs in place
 *   node scripts/sync-docs.mjs --check    report drift, exit 1, change nothing
 *
 * Requires `npm run build` first, since the counts are read from `dist/`.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const checkOnly = process.argv.includes('--check');

const distEntry = join(root, 'dist', 'index.js');
if (!existsSync(distEntry)) {
  console.error('sync-docs: dist/index.js is missing. Run `npm run build` first.');
  process.exit(1);
}

const { getRuleCount, getRulesByCategory, categories } = await import(distEntry);
const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

const ruleCount = getRuleCount();
const categoryCount = categories.length;

if (!Number.isInteger(ruleCount) || ruleCount === 0) {
  console.error('sync-docs: the registry reported no rules. Refusing to write 0 into the docs.');
  process.exit(1);
}

/**
 * Rewrites keyed to the phrases that carry a *total*, never a bare number.
 *
 * The docs also list a per-category count on every category line ("Core SEO
 * (19 rules)"). A blanket `\d+ rules` replacement would flatten all of those to
 * the total, so every pattern here is anchored on surrounding words that only
 * ever appear next to a total.
 */
const rewrites = [
  // "across 316 rules and 20 categories", "against 316 rules across 20 categories"
  [/\b(across|against|with) \d+ rules (and|across) \d+ categories/g,
    `$1 ${ruleCount} rules $2 ${categoryCount} categories`],
  // "**316 rules** across **20 categories**", "**316 rules** in **20 categories**"
  [/\*\*\d+ rules\*\* (across|in) \*\*\d+ categories\*\*/g,
    `**${ruleCount} rules** $1 **${categoryCount} categories**`],
  // "for all 316 rules"
  [/\ball \d+ rules\b/g, `all ${ruleCount} rules`],
  // "## Categories & Rules (261 total)"
  [/\(\d+ total\)/g, `(${ruleCount} total)`],
  // "Runs 261 audit rules against each page" — the phrasing that drifted to 261
  // while every other total tracked, because no pattern here matched it.
  [/\bRuns \d+ audit rules\b/g, `Runs ${ruleCount} audit rules`],
  // "Current version: **3.5.0**." in CLAUDE.md. Hand-corrected on 2026-09-04
  // and stale again the same day, because the version rewrite only ever
  // reached the skill frontmatter.
  [/(Current version: \*\*)\d+\.\d+\.\d+(\*\*)/g, `$1${version}$2`],
];

/** The skill manifest tracks the package it wraps. */
const frontmatterVersion = [/^(\s*version:\s*)"[^"]*"/m, `$1"${version}"`];

const targets = [
  { file: 'SKILL.md', rules: [...rewrites, frontmatterVersion] },
  // The repo carries two copies of the skill doc. Only the root one was synced,
  // so the other drifted on its own — same 261, same stale weights.
  { file: 'skill/SKILL.md', rules: [...rewrites, frontmatterVersion] },
  { file: 'README.md', rules: rewrites },
  { file: 'CLAUDE.md', rules: rewrites },
  { file: 'docs/SEO-AUDIT-RULES.md', rules: rewrites },
];

const changed = [];
for (const { file, rules } of targets) {
  const path = join(root, file);
  if (!existsSync(path)) continue;

  const before = readFileSync(path, 'utf8');
  const after = rules.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), before);

  if (after !== before) {
    changed.push(file);
    if (!checkOnly) writeFileSync(path, after, 'utf8');
  }
}

/**
 * Per-category counts appear as "Core SEO (19 rules)" beside a label that is
 * usually the category name. Where a doc uses a different label, it is aliased
 * here rather than guessed, and any label that resolves to no category is
 * reported instead of being quietly skipped — a renamed category should surface
 * as a failure, not rot silently.
 */
const LABEL_ALIASES = { 'Core SEO': 'core', Core: 'core' };

const categoryByLabel = new Map(categories.map((c) => [c.name, c.id]));
for (const [label, id] of Object.entries(LABEL_ALIASES)) categoryByLabel.set(label, id);

const liveByCategoryId = new Map(categories.map((c) => [c.id, getRulesByCategory(c.id).length]));

const unresolvedLabels = [];
const seenCategoryIds = new Set();

// "**Label** (N rules)" in SKILL.md, "### Label (N rules)" in README.md.
const CATEGORY_LINE = /(\*\*|### )([A-Za-z0-9/ -]+?)(\*\*)? \((\d+) rules?\)/g;

for (const file of ['SKILL.md', 'skill/SKILL.md', 'README.md']) {
  const path = join(root, file);
  if (!existsSync(path)) continue;

  const before = readFileSync(path, 'utf8');
  const after = before.replace(CATEGORY_LINE, (whole, open, label, close, says) => {
    const id = categoryByLabel.get(label.trim());
    if (!id) {
      unresolvedLabels.push({ file, label: label.trim() });
      return whole;
    }
    seenCategoryIds.add(id);
    const live = liveByCategoryId.get(id);
    if (Number(says) === live) return whole;
    // Legal Compliance holds a single rule and reads "(1 rule)".
    const noun = live === 1 ? 'rule' : 'rules';
    return `${open}${label}${close ?? ''} (${live} ${noun})`;
  });

  if (after !== before) {
    if (!changed.includes(file)) changed.push(file);
    if (!checkOnly) writeFileSync(path, after, 'utf8');
  }
}

/**
 * The "fix in this order" list carries a weight per category, and the list is
 * ordered by that weight. Both drifted: it claimed Core 12 / Performance 12 /
 * Accessibility 4 while the registry said 11 / 10 / 7, and with Accessibility
 * at 7 the list was no longer in the order it promises — it had Accessibility
 * eleventh, below three 5% categories.
 *
 * Values are rewritten and the lines re-sorted by live weight. The sort is
 * stable, so categories that share a weight keep the hand-chosen order they
 * already had, and the prose after each dash is carried across untouched.
 */
const WEIGHT_LINE = /^(\d+)\. \*\*([A-Za-z0-9/ -]+?)\*\* \((\d+)%\)( - .*)$/;
const weightByCategoryId = new Map(categories.map((c) => [c.id, c.weight]));

for (const file of ['SKILL.md', 'skill/SKILL.md']) {
  const path = join(root, file);
  if (!existsSync(path)) continue;

  const before = readFileSync(path, 'utf8');
  const lines = before.split('\n');

  // The block is the one run of consecutive numbered weight lines.
  let start = -1;
  let end = -1;
  for (let i = 0; i < lines.length; i++) {
    if (WEIGHT_LINE.test(lines[i])) {
      if (start === -1) start = i;
      end = i;
    } else if (start !== -1 && i > end + 1) {
      break;
    }
  }
  if (start === -1) continue;

  const parsed = [];
  let unresolved = false;
  for (let i = start; i <= end; i++) {
    const m = lines[i].match(WEIGHT_LINE);
    if (!m) continue;
    const label = m[2].trim();
    const id = categoryByLabel.get(label);
    if (!id) {
      unresolvedLabels.push({ file, label });
      unresolved = true;
      continue;
    }
    parsed.push({ label, prose: m[4], weight: weightByCategoryId.get(id) });
  }
  // A label the registry does not know means the block cannot be rebuilt
  // safely; it is already reported, so leave the file alone.
  if (unresolved || parsed.length === 0) continue;

  parsed.sort((a, b) => b.weight - a.weight);
  const rebuilt = parsed.map((c, i) => `${i + 1}. **${c.label}** (${c.weight}%)${c.prose}`);
  const after = [...lines.slice(0, start), ...rebuilt, ...lines.slice(end + 1)].join('\n');

  if (after !== before) {
    if (!changed.includes(file)) changed.push(file);
    if (!checkOnly) writeFileSync(path, after, 'utf8');
  }
}

const missingFromDocs = categories.filter((c) => !seenCategoryIds.has(c.id));

console.log(`sync-docs: registry has ${ruleCount} rules across ${categoryCount} categories, package is v${version}`);

if (changed.length === 0) {
  console.log('sync-docs: totals and version already in sync.');
} else if (checkOnly) {
  console.error(`sync-docs: out of sync: ${changed.join(', ')}`);
} else {
  console.log(`sync-docs: updated ${changed.join(', ')}`);
}

// Not auto-fixable: a label the registry does not know, or a category the docs
// never mention. Both need a human, so both are reported loudly.
if (unresolvedLabels.length > 0) {
  console.warn('\nsync-docs: doc labels that match no category (rename, or add an alias):');
  for (const u of unresolvedLabels) console.warn(`  ${u.file}: "${u.label}"`);
}

if (missingFromDocs.length > 0) {
  console.warn('\nsync-docs: categories the docs never list:');
  for (const c of missingFromDocs) {
    console.warn(`  ${c.name} (${c.id}) — ${liveByCategoryId.get(c.id)} rules`);
  }
}

if (checkOnly && (changed.length > 0 || unresolvedLabels.length > 0 || missingFromDocs.length > 0)) {
  process.exit(1);
}
