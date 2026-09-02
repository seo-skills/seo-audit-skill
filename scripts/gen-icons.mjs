#!/usr/bin/env node
/**
 * Render the app icon from the brand mark.
 *
 * electron-builder wants one 1024x1024 PNG and derives every platform size
 * from it (.icns, .ico, AppImage). Generating it here rather than committing a
 * hand-exported blob means the icon is reproducible: when the brand mark
 * changes, `npm run gen:icons` is the whole update, and the SVG stays the
 * single source of truth.
 *
 * Rendered through Chromium (already a dependency for Core Web Vitals) because
 * ImageMagick's built-in SVG renderer approximates paths badly without
 * librsvg, and the mark is all curves.
 *
 * Usage: node scripts/gen-icons.mjs [--check]
 *   --check  re-render to a temp file and fail if it differs from what is
 *            committed, without writing. For CI.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { chromium } from 'playwright';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = join(root, 'electron/resources/brand/seomator-mark.svg');
const OUTPUT = join(root, 'electron/resources/icon.png');
const SIZE = 1024;

/**
 * Fraction of the canvas left empty around the mark.
 *
 * The mark is a full-bleed circle. Dropped into an icon canvas untouched it
 * renders edge to edge, which reads as oversized beside macOS icons that sit
 * inside the standard squircle with breathing room. ~9% inset puts the circle
 * on the same optical footing as its neighbours in the Dock, and costs
 * nothing on Windows or Linux. Set to 0 for a full-bleed mark.
 */
const PADDING_RATIO = 0.09;

const check = process.argv.includes('--check');

/**
 * Rasterize an SVG at the given square size on a transparent canvas.
 *
 * The corners stay transparent — every platform masks or pads icons itself,
 * so baking a background in would fight that.
 */
async function render(svg, size) {
  const inset = Math.round(size * PADDING_RATIO);
  const drawn = size - inset * 2;
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({
      viewport: { width: size, height: size },
      deviceScaleFactor: 1,
    });
    await page.setContent(
      `<!doctype html><meta charset="utf-8">` +
        `<style>html,body{margin:0;padding:0;background:transparent}` +
        `body{display:flex;align-items:center;justify-content:center;` +
        `width:${size}px;height:${size}px}` +
        `svg{display:block;width:${drawn}px;height:${drawn}px}</style>` +
        svg
    );
    return await page.screenshot({ omitBackground: true, type: 'png' });
  } finally {
    await browser.close();
  }
}

const svg = readFileSync(SOURCE, 'utf8');
const png = await render(svg, SIZE);

if (check) {
  if (!existsSync(OUTPUT)) {
    console.error(`gen-icons: ${OUTPUT} is missing. Run: npm run gen:icons`);
    process.exitCode = 1;
  } else {
    const hash = (b) => createHash('sha256').update(b).digest('hex').slice(0, 12);
    const current = readFileSync(OUTPUT);
    // Chromium's PNG encoder is deterministic for identical input, so a
    // mismatch means the source mark moved ahead of the committed icon.
    if (hash(current) === hash(png)) {
      console.log(`gen-icons: icon.png is in sync with ${SIZE}px render of the brand mark.`);
    } else {
      console.error('gen-icons: icon.png does not match the brand mark. Run: npm run gen:icons');
      process.exitCode = 1;
    }
  }
} else {
  writeFileSync(OUTPUT, png);
  console.log(`gen-icons: wrote ${OUTPUT} (${SIZE}x${SIZE}, ${png.length} bytes)`);
}
