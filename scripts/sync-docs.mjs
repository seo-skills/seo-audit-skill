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
];

/** The skill manifest tracks the package it wraps. */
const frontmatterVersion = [/^(\s*version:\s*)"[^"]*"/m, `$1"${version}"`];

const targets = [
  { file: 'SKILL.md', rules: [...rewrites, frontmatterVersion] },
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
const LABEL_ALIASES = { 'Core SEO': 'core' };

const categoryByLabel = new Map(categories.map((c) => [c.name, c.id]));
for (const [label, id] of Object.entries(LABEL_ALIASES)) categoryByLabel.set(label, id);

const liveByCategoryId = new Map(categories.map((c) => [c.id, getRulesByCategory(c.id).length]));

const unresolvedLabels = [];
const seenCategoryIds = new Set();

// "**Label** (N rules)" in SKILL.md, "### Label (N rules)" in README.md.
const CATEGORY_LINE = /(\*\*|### )([A-Za-z0-9/ -]+?)(\*\*)? \((\d+) rules?\)/g;

for (const file of ['SKILL.md', 'README.md']) {
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
