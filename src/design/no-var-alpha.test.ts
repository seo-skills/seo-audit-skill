/**
 * The `var(--color-x)15` bug class.
 *
 * Appending a hex alpha suffix to a colour is a real CSS idiom — but only for a
 * hex *literal*. Once `getScoreColor()` started returning a custom property,
 * every `` `${color}15` `` call site silently became `var(--color-pass)15`,
 * which is not a colour. Browsers drop the whole declaration, so the badge
 * rendered with no background: white-on-white in the highest-priority element
 * on the page, and no error anywhere.
 *
 * It survived a token audit (the token values were correct) and a typecheck
 * (the type is `string`, and it is). It shipped on three surfaces at once.
 * This test is the thing that would have caught it.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';

const ROOT = resolve(__dirname, '../..');
const SOURCE_DIRS = ['src', 'ui', 'electron'];

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist' || entry.startsWith('dist-')) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx|css)$/.test(entry)) out.push(full);
  }
  return out;
}

/** `var(--anything)` immediately followed by hex digits: an alpha suffix on a non-hex colour. */
const VAR_WITH_ALPHA = /var\(--[a-z0-9-]+\)[0-9a-f]{2,8}\b/gi;

/** A template hole immediately followed by hex digits, e.g. `${color}15`. */
const INTERPOLATED_ALPHA = /\$\{[^}]*(?:olor|ackground|tint|fill|stroke)[^}]*\}[0-9a-f]{2}\b/gi;

describe('no alpha suffix on a non-literal colour', () => {
  const files = SOURCE_DIRS.flatMap((d) => walk(join(ROOT, d)));

  it('scans a meaningful number of files', () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it.each([
    ['var() with a hex alpha suffix', VAR_WITH_ALPHA],
    ['interpolated colour with a hex alpha suffix', INTERPOLATED_ALPHA],
  ])('finds no %s', (_label, pattern) => {
    const offences: string[] = [];
    for (const file of files) {
      // The doc comments in this file and its two subjects describe the bug.
      if (/no-var-alpha\.test\.ts$/.test(file)) continue;
      const text = readFileSync(file, 'utf8');
      text.split('\n').forEach((line, i) => {
        if (line.trimStart().startsWith('*')) return; // doc comment describing the bug
        const hits = line.match(new RegExp(pattern.source, pattern.flags));
        if (hits) offences.push(`${file.slice(ROOT.length + 1)}:${i + 1}  ${hits.join(', ')}`);
      });
    }
    expect(offences, `\n${offences.join('\n')}\n`).toEqual([]);
  });
});
