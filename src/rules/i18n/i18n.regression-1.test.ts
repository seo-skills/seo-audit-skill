// Regression: ISSUE-010 — a page linking to its own translations was called a "single-language site"
// Found by /qa on 2026-10-15
// Report: .gstack/qa-reports/run-20261015T075717Z/qa-report-developer-mozilla-org-2026-10-15.md
//
// developer.mozilla.org/en-US/docs/Web/HTML links to nine translations of
// itself (/de/docs/Web/HTML, /fr/docs/Web/HTML, ...) through its language
// switcher and declares hreflang nowhere: not in the HTML, the Link header or
// the sitemap. i18n-hreflang passed it with "No hreflang tags found
// (single-language site)", a claim the rule had no way to make. A site that
// declared hreflang in its Link header got the same message.
import { describe, it, expect } from 'vitest';
import { createTestContext } from '../test-context.js';
import { hreflangRule } from './hreflang.js';
import { hreflangReturnLinksRule } from './hreflang-return-links.js';
import type { LinkInfo } from '../../types.js';

const PAGE = 'https://developer.mozilla.org/en-US/docs/Web/HTML';
const HTML = '<html lang="en-US"><head><title>HTML</title></head><body></body></html>';

function links(...paths: string[]): LinkInfo[] {
  return paths.map((path) => ({
    href: new URL(path, PAGE).href,
    text: path,
    isInternal: true,
    isNoFollow: false,
  }));
}

describe('i18n-hreflang without hreflang annotations (ISSUE-010)', () => {
  it('warns when the page links to other-language versions of itself', async () => {
    const context = createTestContext(HTML, {
      url: PAGE,
      links: links('/de/docs/Web/HTML', '/fr/docs/Web/HTML', '/pt-BR/docs/Web/HTML', '/en-US/docs/Web/CSS'),
    });
    const result = await hreflangRule.run(context);
    expect(result.status).toBe('warn');
    expect(result.details?.translationLinks).toEqual([
      'https://developer.mozilla.org/de/docs/Web/HTML',
      'https://developer.mozilla.org/fr/docs/Web/HTML',
      'https://developer.mozilla.org/pt-BR/docs/Web/HTML',
    ]);
  });

  it('passes a page without translation links, without claiming the site has one language', async () => {
    const context = createTestContext(HTML, { url: PAGE, links: links('/en-US/docs/Web/CSS') });
    const result = await hreflangRule.run(context);
    expect(result.status).toBe('pass');
    expect(result.message).not.toMatch(/single-language/);
  });

  it('does not read same-path links under non-locale prefixes as translations', async () => {
    const context = createTestContext('<html lang="en"><head></head><body></body></html>', {
      url: 'https://example.com/api/users',
      links: links('https://example.com/app/users', 'https://example.com/v2/users'),
    });
    expect((await hreflangRule.run(context)).status).toBe('pass');
  });

  it('recognises hreflang declared in the HTTP Link header', async () => {
    const context = createTestContext(HTML, {
      url: PAGE,
      headers: { link: '<https://developer.mozilla.org/de/docs/Web/HTML>; rel="alternate"; hreflang="de"' },
      links: links('/de/docs/Web/HTML'),
    });
    const result = await hreflangRule.run(context);
    expect(result.status).toBe('pass');
    expect(result.message).toMatch(/Link header/);
  });

  it('i18n-hreflang-return-links does not claim a single-language site either', async () => {
    const result = await hreflangReturnLinksRule.run(createTestContext(HTML, { url: PAGE }));
    expect(result.message).not.toMatch(/single-language/);
  });
});
