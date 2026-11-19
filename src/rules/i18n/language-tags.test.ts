/**
 * Language tags in `<html lang>` and hreflang (GitHub issue #14).
 *
 * `i18n-lang-attribute` warned on valid tags (`es-419`, `EN-US`,
 * `de-CH-1996`) and passed the malformed `es419`; `i18n-hreflang` and
 * `i18n-hreflang-incoming-invalid` failed hreflang codes with a script
 * subtag (`zh-Hant`, `zh-Hans-US`) or a lowercase region (`en-gb`). Language
 * tags are case-insensitive (RFC 5646), and Google reads an hreflang code as a
 * language with an optional ISO 15924 script and ISO 3166-1 alpha-2 region.
 * The first two tables are the issue's own reproduction.
 */
import { describe, it, expect } from 'vitest';
import * as cheerio from 'cheerio';
import type { AuditContext, SiteContext } from '../../types.js';
import { langAttributeRule } from './lang-attribute.js';
import { hreflangRule } from './hreflang.js';
import { hreflangIncomingInvalidRule } from './hreflang-incoming-invalid.js';
import { isHreflangCode, isLanguageTag } from './language-tag.js';

function context(html: string, url = 'https://ex.com/', site?: SiteContext): AuditContext {
  return {
    url,
    html,
    $: cheerio.load(html),
    headers: {},
    statusCode: 200,
    responseTime: 10,
    cwv: {},
    links: [],
    images: [],
    invalidLinks: [],
    specialLinks: [],
    figures: [],
    inlineSvgs: [],
    pictureElements: [],
    ...(site && { site }),
  };
}

/** The issue's page: one alternate under test, a self-reference and x-default */
function alternates(code: string): string {
  return (
    '<html lang="en"><head>' +
    `<link rel="alternate" hreflang="${code}" href="https://ex.com/a">` +
    '<link rel="alternate" hreflang="en" href="https://ex.com/">' +
    '<link rel="alternate" hreflang="x-default" href="https://ex.com/">' +
    '</head></html>'
  );
}

describe('i18n-lang-attribute reads BCP 47 tags (#14)', () => {
  it.each([
    ['es-419', 'pass'],
    ['EN-US', 'pass'],
    ['de-CH-1996', 'pass'],
    ['es419', 'warn'],
    ['zh-Hant-TW', 'pass'],
    ['sr-Latn-RS', 'pass'],
    ['en-US-x-twain', 'pass'],
    ['en_US', 'warn'],
    ['english', 'warn'],
  ])('<html lang="%s"> is a %s', async (tag, status) => {
    const result = await langAttributeRule.run(context(`<html lang="${tag}"><body>x</body></html>`));
    expect(result.status).toBe(status);
  });
});

describe('i18n-hreflang reads script subtags and any case (#14)', () => {
  // `EN` would duplicate the page's own `en`: case does not make a second code
  it.each(['en-GB', 'zh-Hant', 'zh-Hans-US', 'en-gb', 'DE'])('passes hreflang="%s"', async (code) => {
    const result = await hreflangRule.run(context(alternates(code)));
    expect(result.status).toBe('pass');
    expect(result.details?.issues ?? null).toBeNull();
  });

  it.each(['es419', 'en_US', 'english', 'GB', 'es-419'])('fails hreflang="%s"', async (code) => {
    const result = await hreflangRule.run(context(alternates(code)));
    expect(result.status).toBe('fail');
    const issues = result.details?.issues as Array<{ issue: string }>;
    expect(issues.map((i) => i.issue)).toContain(`Invalid hreflang format: "${code}"`);
  });

  it('counts X-Default as the x-default annotation', async () => {
    const html =
      '<html lang="en"><head>' +
      '<link rel="alternate" hreflang="en" href="https://ex.com/">' +
      '<link rel="alternate" hreflang="de" href="https://ex.com/de">' +
      '<link rel="alternate" hreflang="X-Default" href="https://ex.com/">' +
      '</head></html>';
    const result = await hreflangRule.run(context(html));
    expect(result.status).toBe('pass');
  });

  it('reads en-GB and en-gb as the same code, so a pair is a duplicate', async () => {
    const html =
      '<html lang="en"><head>' +
      '<link rel="alternate" hreflang="en" href="https://ex.com/">' +
      '<link rel="alternate" hreflang="en-GB" href="https://ex.com/uk">' +
      '<link rel="alternate" hreflang="en-gb" href="https://ex.com/gb">' +
      '<link rel="alternate" hreflang="x-default" href="https://ex.com/">' +
      '</head></html>';
    const result = await hreflangRule.run(context(html));
    const issues = result.details?.issues as Array<{ issue: string }>;
    expect(issues.map((i) => i.issue)).toContain('Duplicate hreflang: "en-gb"');
  });
});

describe('i18n-hreflang-incoming-invalid reads the same codes (#14)', () => {
  it('passes incoming zh-Hant and zh-Hans-US annotations', async () => {
    const page = (hreflangOut: Record<string, string>) => ({
      statusCode: 200,
      noindex: false,
      nofollow: false,
      disallowed: false,
      hreflangOut,
    });
    const site: SiteContext = {
      entryUrl: 'https://ex.com/',
      pageCount: 3,
      depthByUrl: new Map(),
      inboundLinksByUrl: new Map(),
      outboundLinksByUrl: new Map(),
      normalize: (u: string) => u,
      pages: new Map([
        ['https://ex.com/', page({})],
        ['https://ex.com/tw', page({ 'zh-Hant': 'https://ex.com/' })],
        ['https://ex.com/us', page({ 'zh-Hans-US': 'https://ex.com/' })],
      ]),
    };
    const result = await hreflangIncomingInvalidRule.run(context('<html><head></head></html>', 'https://ex.com/', site));
    expect(result.status).toBe('pass');
    expect(result.details?.incomingCount).toBe(2);
  });
});

describe('the tag checks themselves', () => {
  it('reads RFC 5646 forms beyond language-region', () => {
    for (const tag of ['zh-yue', 'zh-cmn-Hans-CN', 'de-1996', 'en-a-bbb-x-a-ccc', 'x-private', 'i-klingon', 'sgn-BE-FR']) {
      expect(isLanguageTag(tag), tag).toBe(true);
    }
  });

  it('rejects what RFC 5646 or the registry rules out', () => {
    for (const tag of ['', 'e', 'en-', '-en', 'en--US', 'en-12', 'en-Latn-Latn', 'root', 'en-x', 'en_GB']) {
      expect(isLanguageTag(tag), tag).toBe(false);
    }
  });

  it('keeps hreflang to what Google reads', () => {
    expect(isHreflangCode('x-default')).toBe(true);
    expect(isHreflangCode('X-DEFAULT')).toBe(true);
    expect(isHreflangCode('zh-Hant-TW')).toBe(true);
    expect(isHreflangCode('de-CH-1996')).toBe(false);
    expect(isHreflangCode('fil')).toBe(false);
  });
});
