// One-off extraction of the reference audit "Hints" catalog from a crawl dump.
// Usage: node scripts/extract-hints.mjs <crawl-dump.md> <domain>
// Output: reports/hints-catalog.json
import { readFileSync, writeFileSync } from 'node:fs';

const [, , DUMP, DOMAIN] = process.argv;
if (!DUMP || !DOMAIN) {
  console.error('usage: node scripts/extract-hints.mjs <crawl-dump.md> <domain>');
  process.exit(1);
}
const OUT = 'reports/hints-catalog.json';
const escapedDomain = DOMAIN.replace(/\./g, '\\.');

const text = readFileSync(DUMP, 'utf8');
const lines = text.split('\n');

// --- 1. Split into pages on "## https://<domain>/hints/..." delimiters ---
const pages = [];
let current = null;
const pageDelimiter = new RegExp(`^## (https:\\/\\/${escapedDomain}\\/hints\\/[^\\s]*)\\s*$`);
for (const line of lines) {
  const m = line.match(pageDelimiter);
  if (m) {
    if (current) pages.push(current);
    current = { url: m[1], lines: [] };
  } else if (current) {
    current.lines.push(line);
  }
}
if (current) pages.push(current);

const IMPORTANCE = ['Critical', 'High', 'Medium', 'Low', 'Insight'];
const WARN_TYPE = ['Issue', 'Potential Issue', 'Opportunity', 'Insight', 'Diagnostic'];

const clean = (s) =>
  s
    .replace(/&#x200B;|​/g, '')
    .replace(/\\</g, '<')
    .replace(/\\>/g, '>')
    .trim();

// --- 2. Build slug -> importance map from the "## <Category> Hints" sidebar
//        lists (present on every page, grouped by "### Critical" etc.) ---
const importanceBySlug = {}; // slug -> { importance, name, category }
for (const page of pages) {
  let inList = false;
  let level = null;
  for (let i = 0; i < page.lines.length; i++) {
    const line = page.lines[i];
    if (/^## \w[\w -]* Hints\s*$/.test(line)) { inList = true; level = null; continue; }
    if (inList && /^## /.test(line) && !/^### /.test(line)) { inList = false; level = null; continue; }
    if (!inList) continue;
    const h = line.match(/^-? ?### (Critical|High|Medium|Low|Insight)\s*$/);
    if (h) { level = h[1]; continue; }
    const linkRe = new RegExp(`^\\s*- \\[(.*?)\\]\\(https:\\/\\/${escapedDomain}\\/hints\\/([\\w-]+)\\/([\\w-]+)\\/\\)`);
    const link = line.match(linkRe);
    if (link && level) {
      const [, name, category, slug] = link;
      importanceBySlug[slug] = { importance: level, name: clean(name), category };
    }
  }
}

// --- 3. Per-page extraction ---
const hints = [];
const problems = [];

for (const page of pages) {
  const pagePath = new RegExp(`^https:\\/\\/${escapedDomain}\\/hints\\/([\\w-]+)\\/([\\w-]+)\\/$`);
  const um = page.url.match(pagePath);
  if (!um) continue; // skip /hints/ root and category index pages
  const [, category, slug] = um;
  const body = page.lines;

  // Title from frontmatter
  let title = null;
  for (let i = 0; i < body.length; i++) {
    const t = body[i].match(/^title:\s*"(.*)"\s*$/);
    if (t) { title = clean(t[1]).replace(/\s*\|\s*[^|]*$/, ''); break; }
    if (i > 15) break; // frontmatter is always at the top
  }

  // Importance: standalone level line followed (after any blank lines) by its
  // boilerplate explanation, occurring after the breadcrumb trail.
  const nextText = (from) => {
    for (let j = from + 1; j < Math.min(from + 5, body.length); j++) {
      const l = body[j].trim();
      if (l) return l;
    }
    return '';
  };
  let importance = null;
  let warningType = null;
  for (let i = 0; i < body.length - 1; i++) {
    const line = body[i].trim();
    if (!importance && IMPORTANCE.includes(line) && /^This Hint (requires immediate|is very important|is worth investigating|is of the lowest|is neither an issue)/.test(nextText(i))) {
      importance = line;
      continue;
    }
    if (importance && !warningType && WARN_TYPE.includes(line) && /^This Hint (represents|is unlikely|flags)/.test(nextText(i))) {
      warningType = line;
      break;
    }
  }

  // Description: first paragraph(s) after the "# **<name>**" body heading
  let description = null;
  for (let i = 0; i < body.length; i++) {
    if (/^# \*\*/.test(body[i])) {
      const paras = [];
      for (let j = i + 1; j < body.length; j++) {
        const l = body[j].trim();
        if (!l) { if (paras.length) break; else continue; }
        if (/^#/.test(l)) break;
        paras.push(l);
        if (paras.join(' ').length > 400) break;
      }
      description = paras.join(' ');
      break;
    }
  }

  // Hints with Insight importance carry a single Insight marker that serves as
  // both importance and warning type.
  if (importance === 'Insight' && !warningType) warningType = 'Insight';

  // Cross-check with sidebar-derived importance
  const sidebar = importanceBySlug[slug];
  if (sidebar && sidebar.importance !== importance) {
    problems.push(`${slug}: page importance '${importance}' != sidebar '${sidebar.importance}'`);
  }
  if (sidebar && sidebar.category !== category) {
    problems.push(`${slug}: page category '${category}' != sidebar '${sidebar.category}'`);
  }

  const missing = [];
  if (!title) missing.push('title');
  if (!importance) missing.push('importance');
  if (!warningType) missing.push('warningType');
  if (!description) missing.push('description');
  if (missing.length) problems.push(`${slug}: missing ${missing.join(', ')}`);

  // Trim description to ~2 sentences
  if (description) {
    const sentences = description.match(/[^.!?]*[.!?]+(\s|$)/g);
    if (sentences && sentences.length > 2) description = sentences.slice(0, 2).join(' ').trim();
  }

  hints.push({
    category,
    slug,
    url: new URL(page.url).pathname, // path only — keep the catalog domain-free
    title,
    importance: importance ?? sidebar?.importance ?? null,
    warningType,
    description,
  });
}

// --- 4. Coverage sanity: sidebar lists hints that may lack a crawled page ---
const crawledSlugs = new Set(hints.map((h) => h.slug));
const listedOnly = Object.entries(importanceBySlug)
  .filter(([slug]) => !crawledSlugs.has(slug))
  .map(([slug, v]) => ({ slug, ...v }));

const stats = {};
for (const h of hints) {
  stats[h.category] = stats[h.category] || { total: 0, byImportance: {} };
  stats[h.category].total++;
  const imp = h.importance || 'unknown';
  stats[h.category].byImportance[imp] = (stats[h.category].byImportance[imp] || 0) + 1;
}

writeFileSync(
  OUT,
  JSON.stringify({ extractedAt: new Date().toISOString(), count: hints.length, hints, listedButNotCrawled: listedOnly }, null, 2)
);

console.log(`pages split: ${pages.length}`);
console.log(`hint pages extracted: ${hints.length}`);
console.log(`hints listed in sidebars but not crawled: ${listedOnly.length}`);
if (listedOnly.length) console.log(listedOnly.map((l) => `  ${l.category}/${l.slug} (${l.importance})`).join('\n'));
console.log(`\nparse problems (${problems.length}):`);
console.log(problems.map((p) => `  ${p}`).join('\n') || '  none');
console.log('\nper-category stats:');
for (const [cat, s] of Object.entries(stats)) {
  console.log(`  ${cat}: ${s.total} — ${Object.entries(s.byImportance).map(([k, v]) => `${k}:${v}`).join(' ')}`);
}
