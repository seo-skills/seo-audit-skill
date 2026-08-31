import { describe, it, expect } from 'vitest';
import * as cheerio from 'cheerio';
import {
  mobileParityContentRule,
  mobileParityTitleRule,
  mobileParityCanonicalRule,
  mobileParityStructuredDataRule,
  mobileParityLinksRule,
} from './parity.js';
import type { AuditContext } from '../../types.js';

/**
 * Build a context with a desktop and mobile rendered DOM. Passing only one (or
 * neither) exercises the unmeasured guard.
 */
function ctx(desktopHtml?: string, mobileHtml?: string): AuditContext {
  const base = '<html><body></body></html>';
  return {
    url: 'https://example.com/',
    html: desktopHtml ?? base,
    $: cheerio.load(desktopHtml ?? base),
    headers: {},
    links: [],
    images: [],
    statusCode: 200,
    responseTime: 100,
    cwv: {},
    invalidLinks: [],
    specialLinks: [],
    figures: [],
    inlineSvgs: [],
    pictureElements: [],
    ...(desktopHtml && { renderedHtml: desktopHtml, rendered$: cheerio.load(desktopHtml) }),
    ...(mobileHtml && { mobileHtml, mobile$: cheerio.load(mobileHtml) }),
  };
}

const para = (n: number) => `<p>${Array.from({ length: n }, () => 'word').join(' ')}</p>`;

describe('mobile parity — unmeasured guard', () => {
  const rules = [
    mobileParityContentRule,
    mobileParityTitleRule,
    mobileParityCanonicalRule,
    mobileParityStructuredDataRule,
    mobileParityLinksRule,
  ];

  it.each(rules)('$id reports weight 0 when no mobile render is present', async (rule) => {
    // Desktop render only — parity cannot be judged.
    const result = await rule.run(ctx('<html><body><p>x</p></body></html>', undefined));
    expect(result.weight).toBe(0);
  });
});

describe('mobileParityContentRule', () => {
  it('passes when mobile content matches desktop', async () => {
    const html = `<html><body>${para(200)}</body></html>`;
    const result = await mobileParityContentRule.run(ctx(html, html));
    expect(result.status).toBe('pass');
  });

  it('fails when mobile is missing more than half the content', async () => {
    const desktop = `<html><body>${para(300)}</body></html>`;
    const mobile = `<html><body>${para(100)}</body></html>`;
    const result = await mobileParityContentRule.run(ctx(desktop, mobile));
    expect(result.status).toBe('fail');
    expect(result.details?.desktopWords).toBe(300);
    expect(result.details?.mobileWords).toBe(100);
  });

  it('warns on a moderate content gap', async () => {
    const desktop = `<html><body>${para(300)}</body></html>`;
    const mobile = `<html><body>${para(210)}</body></html>`; // 70%
    expect((await mobileParityContentRule.run(ctx(desktop, mobile))).status).toBe('warn');
  });

  it('does not judge parity on a very short page', async () => {
    const desktop = `<html><body>${para(40)}</body></html>`;
    const mobile = `<html><body>${para(5)}</body></html>`;
    expect((await mobileParityContentRule.run(ctx(desktop, mobile))).status).toBe('pass');
  });
});

describe('mobileParityTitleRule', () => {
  it('fails when the title differs', async () => {
    const desktop = '<html><head><title>Desktop Title</title></head><body></body></html>';
    const mobile = '<html><head><title>Mobile Title</title></head><body></body></html>';
    const result = await mobileParityTitleRule.run(ctx(desktop, mobile));
    expect(result.status).toBe('fail');
  });

  it('warns when only the description differs', async () => {
    const desktop =
      '<html><head><title>T</title><meta name="description" content="Desktop desc"></head><body></body></html>';
    const mobile =
      '<html><head><title>T</title><meta name="description" content="Mobile desc"></head><body></body></html>';
    expect((await mobileParityTitleRule.run(ctx(desktop, mobile))).status).toBe('warn');
  });

  it('passes when both match', async () => {
    const html =
      '<html><head><title>T</title><meta name="description" content="D"></head><body></body></html>';
    expect((await mobileParityTitleRule.run(ctx(html, html))).status).toBe('pass');
  });
});

describe('mobileParityCanonicalRule', () => {
  it('fails when the canonical differs', async () => {
    const desktop =
      '<html><head><link rel="canonical" href="https://example.com/a"></head><body></body></html>';
    const mobile =
      '<html><head><link rel="canonical" href="https://m.example.com/a"></head><body></body></html>';
    expect((await mobileParityCanonicalRule.run(ctx(desktop, mobile))).status).toBe('fail');
  });

  it('passes when the canonical matches', async () => {
    const html =
      '<html><head><link rel="canonical" href="https://example.com/a"></head><body></body></html>';
    expect((await mobileParityCanonicalRule.run(ctx(html, html))).status).toBe('pass');
  });
});

describe('mobileParityStructuredDataRule', () => {
  it('fails when mobile drops a JSON-LD block present on desktop', async () => {
    const desktop =
      '<html><head><script type="application/ld+json">{}</script></head><body></body></html>';
    const mobile = '<html><head></head><body></body></html>';
    const result = await mobileParityStructuredDataRule.run(ctx(desktop, mobile));
    expect(result.status).toBe('fail');
    expect(result.details?.desktopBlocks).toBe(1);
    expect(result.details?.mobileBlocks).toBe(0);
  });

  it('passes when both carry the same structured data', async () => {
    const html =
      '<html><head><script type="application/ld+json">{}</script></head><body></body></html>';
    expect((await mobileParityStructuredDataRule.run(ctx(html, html))).status).toBe('pass');
  });
});

describe('mobileParityLinksRule', () => {
  const links = (n: number) =>
    Array.from({ length: n }, (_, i) => `<a href="/p${i}">link</a>`).join('');

  it('warns when mobile exposes far fewer links', async () => {
    const desktop = `<html><body>${links(20)}</body></html>`;
    const mobile = `<html><body>${links(6)}</body></html>`;
    expect((await mobileParityLinksRule.run(ctx(desktop, mobile))).status).toBe('warn');
  });

  it('ignores fragment and javascript links', async () => {
    const desktop = `<html><body>${links(20)}</body></html>`;
    const mobile = `<html><body>${links(20)}<a href="#top">x</a><a href="javascript:void(0)">y</a></body></html>`;
    const result = await mobileParityLinksRule.run(ctx(desktop, mobile));
    expect(result.status).toBe('pass');
    expect(result.details?.mobileLinks).toBe(20);
  });
});
