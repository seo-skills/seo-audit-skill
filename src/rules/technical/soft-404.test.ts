import { describe, it, expect } from 'vitest';
import { soft404Rule, errorShapedHeading, errorShapedBody, titleSegments } from './soft-404.js';
import { createTestContext } from '../test-context.js';

function page(title: string, words: number, extra = '', h1 = '') {
  const text = Array.from({ length: words }, (_, i) => `word${i}`).join(' ');
  return `<html><head><title>${title}</title></head><body>${h1 ? `<h1>${h1}</h1>` : ''}<p>${text} ${extra}</p></body></html>`;
}

async function status(html: string, statusCode = 200) {
  const context = createTestContext(html);
  context.statusCode = statusCode;
  return (await soft404Rule.run(context)).status;
}

describe('soft-404 title segments', () => {
  it('splits on site-name separators, not inside words', () => {
    expect(titleSegments('404 - Page Not Found | Shop')).toEqual(['404', 'page not found', 'shop']);
    expect(titleSegments('404: This page could not be found.')).toEqual(['404', 'this page could not be found']);
    expect(titleSegments('E-commerce guide')).toEqual(['e-commerce guide']);
  });

  it('matches whole segments only', () => {
    expect(errorShapedHeading('Page not found | Shop')).toBe('page not found');
    expect(errorShapedHeading('Oops! That page can’t be found.')).toBe("oops! that page can't be found");
    expect(errorShapedHeading('Error Handling in Rust')).toBeNull();
    expect(errorShapedHeading('Terrorism Studies MA')).toBeNull();
    expect(errorShapedHeading('Book Room 404')).toBeNull();
    expect(errorShapedHeading('404 errors explained')).toBeNull();
  });

  it('matches body phrases on word boundaries only', () => {
    expect(errorShapedBody('This product is no longer available.')).toBe('no longer available');
    expect(errorShapedBody('The notfound handler')).toBeNull();
  });
});

describe('technical-soft-404', () => {
  it.each([
    ['Error Handling in Rust'],
    ['Terrorism Studies MA'],
    ['Book Room 404'],
  ])('passes the long page titled "%s"', async (title) => {
    expect(await status(page(title, 1800))).toBe('pass');
  });

  it.each([
    ['Page not found | Shop', 40],
    ['404 - Page Not Found | Shop', 40],
    ['Oops! That page can’t be found.', 30],
    ['404: This page could not be found.', 30],
  ])('fails the thin page titled "%s"', async (title, words) => {
    expect(await status(page(title, words))).toBe('fail');
  });

  it('fails an 80-word page whose text says the product is gone', async () => {
    expect(await status(page('Product', 80, 'This product is no longer available'))).toBe('fail');
  });

  it('passes a 400-word FAQ that says "not found" in passing', async () => {
    expect(await status(page('FAQ', 400, 'If your order is not found, contact us.'))).toBe('pass');
  });

  it('passes a 300-word article titled "How to fix 404 errors"', async () => {
    expect(await status(page('How to fix 404 errors', 300))).toBe('pass');
  });

  it('reads the H1 too', async () => {
    expect(await status(page('Shop', 40, '', 'Page not found'))).toBe('fail');
  });

  it('passes a real 404 and ignores other statuses', async () => {
    expect(await status(page('Page not found', 10), 404)).toBe('pass');
    expect(await status(page('Page not found', 10), 500)).toBe('pass');
  });
});
