import { describe, it, expect } from 'vitest';
import { createTestContext } from './rules/test-context.js';
import { buildPageSnapshot } from './page-snapshot.js';

const PAGE = `<!doctype html><html lang="en"><head>
<title>Widgets — Acme</title>
<meta name="description" content="Buy widgets.">
<link rel="canonical" href="https://acme.test/widgets">
<meta property="og:title" content="Acme Widgets">
<meta property="og:image" content="https://acme.test/card.png">
<meta property="og:site_name" content="Acme">
<meta name="twitter:card" content="summary_large_image">
</head><body>
<h1>Widgets</h1><h2>Sizes</h2><h3>Small</h3><h2>Pricing</h2>
<p>One two three four five.</p>
<a href="/a">internal</a><img src="/x.png" alt="x">
</body></html>`;

describe('buildPageSnapshot', () => {
  const snapshot = buildPageSnapshot(
    createTestContext(PAGE, {
      links: [
        { href: '/a', text: 'internal', isInternal: true, isNoFollow: false },
        { href: 'https://other.test', text: 'out', isInternal: false, isNoFollow: false },
      ],
      images: [{ src: '/x.png', alt: 'x' }] as never,
    })
  );

  it('captures the search preview fields', () => {
    expect(snapshot.title).toBe('Widgets — Acme');
    expect(snapshot.description).toBe('Buy widgets.');
    expect(snapshot.canonical).toBe('https://acme.test/widgets');
  });

  it('captures Open Graph and Twitter card data', () => {
    expect(snapshot.og.title).toBe('Acme Widgets');
    expect(snapshot.og.image).toBe('https://acme.test/card.png');
    expect(snapshot.twitterCard).toBe('summary_large_image');
  });

  it('records the heading outline in document order', () => {
    expect(snapshot.headings).toEqual([
      { level: 1, text: 'Widgets' },
      { level: 2, text: 'Sizes' },
      { level: 3, text: 'Small' },
      { level: 2, text: 'Pricing' },
    ]);
  });

  it('splits links by internal and external', () => {
    expect(snapshot.metrics.internalLinks).toBe(1);
    expect(snapshot.metrics.externalLinks).toBe(1);
  });

  it('measures text against body content only', () => {
    // <head> markup is never rendered text, so counting it would understate
    // every page equally.
    expect(snapshot.metrics.wordCount).toBeGreaterThan(0);
    expect(snapshot.metrics.textRatio).toBeGreaterThan(0);
    expect(snapshot.metrics.textRatio).toBeLessThanOrEqual(100);
  });

  it('omits absent fields rather than reporting empty strings', () => {
    const bare = buildPageSnapshot(createTestContext('<html><body><p>x</p></body></html>'));
    expect(bare.title).toBeUndefined();
    expect(bare.description).toBeUndefined();
    expect(bare.og.image).toBeUndefined();
    expect(bare.headings).toEqual([]);
  });
});
