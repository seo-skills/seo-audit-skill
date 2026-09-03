/**
 * A colour next to a themed colour can only be right in one theme.
 *
 * The run buttons carried `color: '#fff'` over `var(--color-warn)` and
 * `var(--color-fail)`. In the light theme those backgrounds are a dark amber
 * and a dark red, so white read at 7.09:1 and 6.47:1. In the dark theme they
 * are a bright amber and a light red, and the same white read at 1.67:1 and
 * 2.77:1 — the Cancel button was very nearly invisible, and nothing in the
 * codebase could notice, because the literal was correct where it was written.
 *
 * The token that flips with the theme is the only safe way to say "on top of
 * that": this test keeps literals out of the surfaces that theme.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, resolve, relative } from 'path';

const ROOT = resolve(__dirname, '../..');

/**
 * Where a literal colour is legitimate.
 * - `tokens.ts` is the definition; literals are the point.
 * - `tokens.css` is generated from it.
 * - The logo is a brand mark: it must not shift with the theme.
 */
const ALLOWED = [
  'src/design/tokens.ts',
  'ui/styles/tokens.css',
  'ui/components/Logo.tsx',
];

const HEX = /#[0-9a-fA-F]{3,8}\b/;
const TAILWIND_FIXED = /\b(?:text|bg|border)-(?:white|black)\b/;

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('dist')) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.(tsx?|css)$/.test(entry)) out.push(full);
  }
  return out;
}

describe('no hardcoded colours on a theming surface', () => {
  const files = walk(join(ROOT, 'ui')).filter(
    (f) => !ALLOWED.includes(relative(ROOT, f)) && !f.endsWith('.test.ts')
  );

  it('has files to check', () => {
    expect(files.length).toBeGreaterThan(15);
  });

  it('finds no hex literal or fixed white/black utility', () => {
    const offences: string[] = [];
    for (const file of files) {
      readFileSync(file, 'utf8')
        .split('\n')
        .forEach((line, i) => {
          // Comments explain the rule; they do not paint anything.
          const code = line.replace(/\/\/.*$/, '').replace(/^\s*\*.*$/, '');
          if (HEX.test(code) || TAILWIND_FIXED.test(code)) {
            offences.push(`${relative(ROOT, file)}:${i + 1}  ${code.trim().slice(0, 90)}`);
          }
        });
    }
    expect(offences, `\nUse a token that flips with the theme:\n${offences.join('\n')}\n`).toEqual([]);
  });
});
