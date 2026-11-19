// The README's desktop app demo: drives the built Electron app with Playwright,
// records the window, and turns the video into docs/assets/desktop-app.gif.
//
// From the repository root, with ffmpeg on PATH:
//
//   npm run rebuild:electron && npm run electron:build
//   export SEOMATOR_HOME=$(mktemp -d)
//   seomator audit https://quotes.toscrape.com            # needs `npm run rebuild:cli`
//   seomator audit https://books.toscrape.com --crawl -m 8 #   first, then electron again
//   node docs/assets/desktop-demo.mjs
//
// The tour opens the books.toscrape.com crawl, so that audit must be stored.
// A window opens on screen while it records: Electron has no headless mode.
// Run `npm run rebuild:cli` afterwards to use the CLI and tests again.
import { _electron as electron, chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

if (!process.env.SEOMATOR_HOME) throw new Error('Set SEOMATOR_HOME to a home with the demo audits');
const ROOT = process.cwd();
const WORK = mkdtempSync(join(tmpdir(), 'seomator-demo-'));
const SIZE = { width: 1280, height: 800 };

const app = await electron.launch({ args: [ROOT], cwd: ROOT, recordVideo: { dir: WORK, size: SIZE } });
const page = await app.firstWindow();
const started = Date.now();
const pause = (ms) => page.waitForTimeout(ms);
// Scrolls jump: a gliding scroll redraws every frame and bloats the GIF
const jump = (dy) => page.evaluate((y) => window.scrollBy({ top: y, behavior: 'instant' }), dy);

await app.evaluate(({ BrowserWindow }, size) => {
  const win = BrowserWindow.getAllWindows()[0];
  win.setContentSize(size.width, size.height);
  win.center();
}, SIZE);
await page.waitForSelector('table tbody tr', { timeout: 30000 });
const historyAt = (Date.now() - started) / 1000;
await pause(3300);

// A crawl's report: the score, then the fix queue
await page.locator('table tbody tr', { hasText: 'books.toscrape.com' }).first().click();
await page.getByText('Fix queue').first().waitFor({ timeout: 30000 });
await pause(4100);
await jump(380);
await pause(1800);

// The points strip, then one column of it filtering the queue
await page.getByText('Where the points went').first().scrollIntoViewIfNeeded();
await jump(-120);
await pause(1800);
await page.locator('[aria-label^="Security:"]').first().click();
await pause(400);
await page.getByText('Fix queue').first().scrollIntoViewIfNeeded();
await pause(2800);

// A new audit from the run form, handed over to its report when it ends
await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
await page.getByText('New audit', { exact: true }).first().click();
const url = page.locator('input[type="url"], input[type="text"]').first();
await url.waitFor({ timeout: 15000 });
await pause(900);
await url.pressSequentially('example.com', { delay: 90 });
await pause(700);
await page.getByRole('button', { name: /Run audit/i }).first().click();
await page.waitForURL(/audits\//, { timeout: 180000 });
await pause(4300);

const video = page.video();
await app.close();
const webm = await video.path();

// macOS draws the traffic lights over the app's inset title bar, outside the
// page the video records, so they are put back as an overlay
const browser = await chromium.launch();
const tab = await browser.newPage({ viewport: SIZE });
const dot = (left, fill, edge) =>
  `<div style="position:absolute;left:${left}px;top:19px;width:12px;height:12px;border-radius:50%;background:${fill};box-shadow:inset 0 0 0 .5px ${edge}"></div>`;
await tab.setContent(`<body style="margin:0;background:transparent">${dot(14, '#FF5F57', '#E0443E')}${dot(34, '#FEBC2E', '#DEA123')}${dot(54, '#28C840', '#1AAB29')}</body>`);
const lights = join(WORK, 'lights.png');
await tab.screenshot({ path: lights, omitBackground: true });
await browser.close();

// 10 fps at 960px, a 1px border so the white app does not melt into a white
// README, and a palette from whole frames so the small traffic lights keep
// their colours
execFileSync('ffmpeg', [
  '-v', 'error', '-ss', String(Math.max(0, historyAt - 0.3)), '-i', webm, '-i', lights,
  '-filter_complex',
  '[0][1]overlay=0:0,fps=10,scale=960:-1:flags=lanczos,pad=iw+2:ih+2:1:1:color=0xd0d7de,split[a][b];' +
    '[a]palettegen=max_colors=160:stats_mode=full[p];[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle',
  '-loop', '0', '-y', join(ROOT, 'docs/assets/desktop-app.gif'),
]);
console.log('wrote docs/assets/desktop-app.gif');
