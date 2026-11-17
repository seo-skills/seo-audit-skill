/**
 * Cross-page rules read a crawled page's status through `pageStatus()` or
 * `pageOutcome()`, never from `SitePageInfo.statusCode`.
 *
 * The raw status lies twice: a page that timed out is 0, and one the site
 * kept rate-limiting is 429 or 503. Read directly, the first looked like a
 * missing page and the second like a broken one: sitemap-non-200 and
 * hreflang-to-broken both did that. The accessors fold both into "unknown".
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const RULES = new URL('.', import.meta.url).pathname;

function ruleFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return ruleFiles(path);
    // test-context.ts builds test sites from fixtures; it is not a rule
    return name.endsWith('.ts') && !name.endsWith('.test.ts') && name !== 'test-context.ts' ? [path] : [];
  });
}

/** Lines that read `.statusCode` off a value taken from the site's page records */
export function directStatusReads(source: string): string[] {
  const names = new Set<string>();
  for (const m of source.matchAll(/(?:const|let)\s+(\w+)\s*=\s*[^;\n]*(?:pages\??\.get\(|getOwnPageInfo\()/g)) names.add(m[1]);
  for (const m of source.matchAll(/for\s*\(\s*const\s+(?:\[\s*\w+\s*,\s*(\w+)\s*\]|(\w+))\s+of\s+[^)\n]*pages[^)\n]*\)/g)) {
    names.add(m[1] ?? m[2]);
  }
  const offending: string[] = [];
  source.split('\n').forEach((line, i) => {
    const direct = /pages\??\.get\([^)]*\)\??\.statusCode/.test(line);
    const viaName = [...names].some((name) => new RegExp(`\\b${name}\\??\\.statusCode\\b`).test(line));
    if (direct || viaName) offending.push(`${i + 1}: ${line.trim()}`);
  });
  return offending;
}

describe('page status reads in cross-page rules', () => {
  it('finds the patterns it is meant to forbid', () => {
    expect(directStatusReads('const info = site.pages.get(key);\nif (info.statusCode >= 400) x();')).toHaveLength(1);
    expect(directStatusReads('if (site.pages?.get(key)?.statusCode === 404) x();')).toHaveLength(1);
    expect(directStatusReads('for (const [url, record] of site.pages) {\n  if (record.statusCode === 0) x();\n}')).toHaveLength(1);
    expect(directStatusReads('const info = site.pages.get(key);\nconst status = pageStatus(info);')).toEqual([]);
  });

  it.each(ruleFiles(RULES).map((path) => [path.slice(RULES.length), path]))('%s reads status through the accessors', (_name, path) => {
    expect(directStatusReads(readFileSync(path, 'utf8'))).toEqual([]);
  });
});
