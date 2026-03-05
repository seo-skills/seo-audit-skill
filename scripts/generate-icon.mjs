/**
 * Icon Generator for SEOmator Desktop App
 *
 * Renders a 1024x1024 icon using Playwright, then saves it as PNG.
 * electron-builder auto-converts this to .icns (macOS) and .ico (Windows).
 *
 * Usage: node scripts/generate-icon.mjs
 */

import { chromium } from 'playwright';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const resourcesDir = join(__dirname, '..', 'electron', 'resources');

if (!existsSync(resourcesDir)) {
  mkdirSync(resourcesDir, { recursive: true });
}

const SIZE = 1024;

const html = `<!DOCTYPE html>
<html>
<head>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: ${SIZE}px;
    height: ${SIZE}px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
  }
  .icon {
    width: ${SIZE}px;
    height: ${SIZE}px;
    border-radius: 224px;
    background: linear-gradient(145deg, #0c1222 0%, #162032 40%, #0f172a 100%);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    position: relative;
    overflow: hidden;
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.06);
  }

  /* Subtle radial glow behind the letter */
  .icon::after {
    content: '';
    position: absolute;
    width: 600px;
    height: 600px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%);
    top: 50%;
    left: 50%;
    transform: translate(-50%, -55%);
  }

  .letter {
    font-family: -apple-system, 'SF Pro Display', 'Inter', 'Helvetica Neue', sans-serif;
    font-size: 540px;
    font-weight: 800;
    color: #f1f5f9;
    line-height: 1;
    letter-spacing: -12px;
    position: relative;
    z-index: 1;
    /* Subtle gradient on the text */
    background: linear-gradient(180deg, #ffffff 0%, #cbd5e1 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    filter: drop-shadow(0 2px 20px rgba(99,102,241,0.3));
  }

  .bar {
    width: 260px;
    height: 7px;
    border-radius: 4px;
    background: linear-gradient(90deg, #22d3ee, #6366f1, #a855f7);
    margin-top: -40px;
    position: relative;
    z-index: 1;
    box-shadow: 0 0 24px rgba(99,102,241,0.5);
  }
</style>
</head>
<body>
  <div class="icon">
    <span class="letter">S</span>
    <div class="bar"></div>
  </div>
</body>
</html>`;

async function generateIcon() {
  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: SIZE, height: SIZE },
    deviceScaleFactor: 1,
  });

  await page.setContent(html, { waitUntil: 'networkidle' });

  const iconPath = join(resourcesDir, 'icon.png');
  const buffer = await page.screenshot({ type: 'png', omitBackground: true });
  writeFileSync(iconPath, buffer);
  console.log(`✓ icon.png (${SIZE}x${SIZE}) → ${iconPath}`);

  await browser.close();
  console.log('Done! electron-builder will auto-convert to .icns / .ico');
}

generateIcon().catch((err) => {
  console.error('Failed to generate icon:', err.message);
  process.exit(1);
});
