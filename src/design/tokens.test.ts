/**
 * The tokens are checked, not just collected.
 *
 * Eight of thirteen text pairs failed WCAG AA before this file existed — amber
 * warning text at 2.15:1 on white, the pass colour at 2.54:1, and the badges
 * worse still at 1.93:1. Consolidating two drifted copies into one source
 * without checking them would have standardised the failure rather than fixed
 * it, which is exactly what the design review warned about.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { LIGHT, DARK, METRICS, TEXT_PAIRS, toCss } from './tokens.js';

/** WCAG relative luminance */
function luminance(rgb: [number, number, number]): number {
  const [r, g, b] = rgb.map((v) => {
    const channel = v / 255;
    return channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function parse(color: string, backdrop: [number, number, number]): [number, number, number] {
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim());
  if (hex) {
    const value = hex[1]!.length === 3 ? hex[1]!.split('').map((c) => c + c).join('') : hex[1]!;
    return [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16)) as [number, number, number];
  }
  const rgba = /rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,/\s]+([\d.]+))?\s*\)/i.exec(color);
  if (!rgba) throw new Error(`cannot parse colour: ${color}`);
  const [r, g, b] = [rgba[1], rgba[2], rgba[3]].map(Number) as [number, number, number];
  const alpha = rgba[4] === undefined ? 1 : Number(rgba[4]);
  // A translucent tint is read against whatever is behind it; composite so the
  // measured ratio is the one a reader actually gets.
  return [r, g, b].map((c, i) => Math.round(c * alpha + backdrop[i]! * (1 - alpha))) as [
    number,
    number,
    number,
  ];
}

function contrast(fg: string, bg: string, backdrop: [number, number, number]): number {
  const background = parse(bg, backdrop);
  const foreground = parse(fg, background);
  const a = luminance(foreground);
  const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

describe('token contrast', () => {
  for (const [themeName, theme, backdrop] of [
    ['light', LIGHT, [255, 255, 255]],
    ['dark', DARK, [24, 24, 27]],
  ] as const) {
    it(`every text pair meets WCAG AA in the ${themeName} theme`, () => {
      const failures: string[] = [];
      for (const { fg, bg } of TEXT_PAIRS) {
        const foreground = theme[fg as keyof typeof theme];
        const background = theme[bg as keyof typeof theme];
        if (!foreground || !background) {
          failures.push(`${fg} on ${bg}: token missing from the ${themeName} theme`);
          continue;
        }
        const ratio = contrast(foreground, background, backdrop as [number, number, number]);
        if (ratio < 4.5) {
          failures.push(`${fg} on ${bg}: ${ratio.toFixed(2)}:1 (needs 4.5:1)`);
        }
      }
      expect(failures).toEqual([]);
    });
  }
});

describe('token hygiene', () => {
  it('is a leaf module with no imports', () => {
    // The CLI bundles this through html-reporter.ts. One import of the rule
    // registry for a colour-per-category map and the bundle grows a cycle
    // through scoring.ts.
    const source = readFileSync(new URL('./tokens.ts', import.meta.url), 'utf8');
    const imports = source.split('\n').filter((line) => /^\s*import\s/.test(line));
    expect(imports).toEqual([]);
  });

  it('defines the same token names in both themes, apart from metrics', () => {
    // A token present in one theme and not the other renders as nothing in the
    // other — which is how --color-neutral came to exist only in the report.
    const lightOnly = Object.keys(LIGHT).filter((name) => !(name in DARK));
    expect(lightOnly).toEqual([]);
  });

  it('emits the dark theme unlayered, so Tailwind aliases keep resolving', () => {
    // ui/styles/tailwind.css aliases these as `--color-pass: var(--color-pass)`,
    // which works only because unlayered CSS outranks cascade layers. Wrapping
    // this output in a layer makes every alias circular at once.
    const css = toCss();
    expect(css).not.toContain('@layer');
    expect(css).toContain(":root {");
    expect(css).toContain("[data-theme='dark']");
    expect(css).toContain('@media (prefers-color-scheme: dark)');
  });

  it('carries the metrics and no webfont fetch', () => {
    const css = toCss();
    expect(css).toContain('--header-height: 52px');
    expect(css).not.toContain('fonts.googleapis.com');
    expect(METRICS['font-sans']).toContain('IBM Plex Sans');
  });
});
