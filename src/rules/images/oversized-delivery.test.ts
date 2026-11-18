/**
 * Image delivery sizing: the rule's arithmetic on probe results, and the
 * probe itself in a real browser.
 */
import { describe, it, expect, afterAll } from 'vitest';
import * as http from 'node:http';
import type { AddressInfo } from 'node:net';
import { existsSync } from 'node:fs';
import { deflateSync, crc32 } from 'node:zlib';
import { chromium } from 'playwright';
import { createTestContext } from '../test-context.js';
import { oversizedDeliveryRule } from './oversized-delivery.js';
import { Auditor } from '../../auditor.js';
import type { AssetInfo } from '../../types.js';

const asset = (url: string, bytes: number) => ({ url, resourceType: 'image', headers: { 'content-length': String(bytes) } }) as unknown as AssetInfo;

function page(entries: unknown[], assets: AssetInfo[] = []) {
  const context = createTestContext('<html></html>', { url: 'https://example.com/' });
  context.renderedHtml = '<html></html>';
  context.probes = { imageSizing: entries };
  context.assets = assets;
  return context;
}

describe('images-oversized-delivery', () => {
  it('fails a 2000 px image shown at 200 px, with the estimated waste', async () => {
    const big = 'https://example.com/big.jpg';
    const result = await oversizedDeliveryRule.run(
      page([{ src: big, naturalWidth: 2000, naturalHeight: 2000, width: 200, height: 200 }], [asset(big, 500 * 1024)])
    );
    expect(result.status).toBe('fail');
    // 500 KiB x (1 - (200x200x4) / (2000x2000)) = 480 KiB
    expect(result.details?.totalWasteBytes).toBe(480 * 1024);
  });

  it('passes an image no larger than twice its box', async () => {
    const right = 'https://example.com/right.jpg';
    const result = await oversizedDeliveryRule.run(
      page([{ src: right, naturalWidth: 400, naturalHeight: 400, width: 200, height: 200 }], [asset(right, 80 * 1024)])
    );
    expect(result.status).toBe('pass');
  });

  it('warns below 200 KiB of total waste, and ignores waste under 4 KiB', async () => {
    const mid = 'https://example.com/mid.jpg';
    const tiny = 'https://example.com/tiny.png';
    const result = await oversizedDeliveryRule.run(
      page(
        [
          { src: mid, naturalWidth: 1600, naturalHeight: 1600, width: 400, height: 400 },
          { src: tiny, naturalWidth: 64, naturalHeight: 64, width: 16, height: 16 },
        ],
        [asset(mid, 100 * 1024), asset(tiny, 2 * 1024)]
      )
    );
    expect(result.status).toBe('warn');
    expect(result.details?.oversizedCount).toBe(1);
  });

  it('judges a resource by the largest box it is shown in', async () => {
    const hero = 'https://example.com/hero.jpg';
    const result = await oversizedDeliveryRule.run(
      page(
        [
          { src: hero, naturalWidth: 1600, naturalHeight: 800, width: 100, height: 50 },
          { src: hero, naturalWidth: 1600, naturalHeight: 800, width: 800, height: 400 },
        ],
        [asset(hero, 300 * 1024)]
      )
    );
    expect(result.status).toBe('pass');
  });

  it('is not measured when the probe did not run', async () => {
    const context = page([]);
    delete context.probes;
    expect(await oversizedDeliveryRule.run(context)).toMatchObject({ status: 'not-measured', reason: 'probe-failed' });
  });
});

/** A decodable greyscale PNG of random pixels, so it compresses badly like a photo */
function noisePng(width: number, height: number): Buffer {
  const chunk = (type: string, data: Buffer) => {
    const head = Buffer.alloc(8);
    head.writeUInt32BE(data.length, 0);
    head.write(type, 4, 'ascii');
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, 'ascii'), data])) >>> 0, 0);
    return Buffer.concat([head, data, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 0; // greyscale
  const rows = Buffer.alloc((width + 1) * height);
  for (let i = 0; i < rows.length; i++) rows[i] = i % (width + 1) === 0 ? 0 : (Math.random() * 256) | 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(rows)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const hasChromium = (() => {
  try {
    return existsSync(chromium.executablePath());
  } catch {
    return false;
  }
})();

describe.skipIf(!hasChromium)('images-oversized-delivery in a real browser', () => {
  const big = noisePng(2000, 1000);
  const right = noisePng(400, 200);
  const server = http.createServer((req, res) => {
    if (req.url === '/big.png') return void res.writeHead(200, { 'content-type': 'image/png', 'content-length': big.length }).end(big);
    if (req.url === '/right.png') return void res.writeHead(200, { 'content-type': 'image/png', 'content-length': right.length }).end(right);
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(`<!doctype html><html lang="en"><head><title>Sizing</title></head><body>
      <img src="/big.png" width="200" height="100" alt="big"><img src="/right.png" width="200" height="100" alt="right"></body></html>`);
  });
  afterAll(() => server.close());

  it('flags the 2000 px image shown at 200 px and not the one sized for its box', async () => {
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const result = await new Auditor({ measureCwv: true, categories: ['images'] }).audit(`${base}/`);
    const finding = result.categoryResults[0].results.find((r) => r.ruleId === 'images-oversized-delivery')!;
    expect(finding.status).toBe('fail');
    const flagged = (finding.details?.oversized as Array<{ url: string; natural: string; displayed: string }>).map((o) => o.url);
    expect(flagged).toEqual([`${base}/big.png`]);
  }, 60_000);
});
