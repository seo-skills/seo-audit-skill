// Joins reports/hints-catalog.json with scripts/hints-mapping.mjs,
// validates that every extracted hint is classified, and emits
// reports/hints-mapping.json + summary stats + PRD gap tables.
import { readFileSync, writeFileSync } from 'node:fs';
import { MAPPING } from './hints-mapping.mjs';

const { hints } = JSON.parse(readFileSync('reports/hints-catalog.json', 'utf8'));

const rows = [];
const errors = [];
for (const h of hints) {
  const m = MAPPING[h.slug];
  if (!m) { errors.push(`no mapping for ${h.slug}`); continue; }
  rows.push({ ...h, ...m });
}
const extra = Object.keys(MAPPING).filter((s) => !hints.find((h) => h.slug === s));
for (const s of extra) errors.push(`mapping for unknown slug ${s}`);
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}

writeFileSync('reports/hints-mapping.json', JSON.stringify(rows, null, 2));

const order = { COVERED: 0, PARTIAL: 1, MISSING: 2, SKIP: 3 };
const cats = {};
for (const r of rows) {
  const c = (cats[r.category] ||= { total: 0, COVERED: 0, PARTIAL: 0, MISSING: 0, SKIP: 0 });
  c.total++;
  c[r.status]++;
}

console.log('category | total | covered | partial | missing | skip');
let T = { total: 0, COVERED: 0, PARTIAL: 0, MISSING: 0, SKIP: 0 };
for (const [cat, c] of Object.entries(cats)) {
  console.log(`${cat} | ${c.total} | ${c.COVERED} | ${c.PARTIAL} | ${c.MISSING} | ${c.SKIP}`);
  for (const k of Object.keys(T)) T[k] += c[k];
}
console.log(`TOTAL | ${T.total} | ${T.COVERED} | ${T.PARTIAL} | ${T.MISSING} | ${T.SKIP}`);

// Gap tables per category (MISSING + PARTIAL only)
console.log('\n\n===== GAP TABLES =====');
for (const [cat] of Object.entries(cats)) {
  const gaps = rows
    .filter((r) => r.category === cat && (r.status === 'MISSING' || r.status === 'PARTIAL'))
    .sort((a, b) => order[a.status] - order[b.status] || (a.importance || '').localeCompare(b.importance || ''));
  if (!gaps.length) continue;
  console.log(`\n### ${cat}`);
  for (const g of gaps) {
    console.log(`| ${g.status} | ${g.title} | ${g.importance} | ${g.ruleId ?? '—'} | ${g.cat ?? '—'} | ${g.effort ?? '—'} | ${g.note}`);
  }
}

// Top gaps by importance (MISSING first, then PARTIAL; Critical > High > Medium > Low)
const impOrder = { Critical: 0, High: 1, Medium: 2, Low: 3, Insight: 4 };
const top = rows
  .filter((r) => r.status === 'MISSING' || r.status === 'PARTIAL')
  .sort((a, b) => order[a.status] - order[b.status] || impOrder[a.importance] - impOrder[b.importance]);
console.log('\n===== TOP GAPS (MISSING then PARTIAL, by importance) =====');
for (const t of top.slice(0, 25)) {
  console.log(`${t.status} | ${t.importance} | ${t.category}/${t.slug} | ${t.title}`);
}
