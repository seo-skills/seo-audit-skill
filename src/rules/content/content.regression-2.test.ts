// Regression: ISSUE-006 — stylesheet and script source counted as page text
// Found by /qa on 2026-10-15
// Report: .gstack/qa-reports/run-20261015T075717Z/qa-report-developer-mozilla-org-2026-10-15.md
//
// `$('body').text()` returns the source of every <script> and <style> in the
// body, and the content of every <template>. developer.mozilla.org ships its
// web components as declarative shadow DOM: 23 <template shadowrootmode>
// carrying 50,649 characters of CSS, 81% of what the rules read as "text".
// content-text-html-ratio passed at 33.6% when the page is 6.4%, below the
// rule's own fail line. content-duplicate-near compared the first 500 words of
// that text, CSS and site navigation, and flagged 5 of 6 crawled pages as
// near-duplicates of each other (similarity 0.68-0.84; 0.006-0.052 on their
// main content).
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestContext } from '../test-context.js';
import { bodyText } from './utils/visible-text.js';
import { textHtmlRatioRule } from './text-html-ratio.js';
import { duplicateNearRule, resetNearDuplicateRegistry } from './duplicate-near.js';

const SHADOW_CSS = `<template shadowrootmode="open"><style>${'.menu{display:flex;gap:1rem;color:var(--text-primary)} '.repeat(40)}</style><slot></slot></template>`;

function page(main: string): string {
  const nav = Array.from({ length: 120 }, (_, i) => `<a href="/docs/${i}">Reference item ${i}</a>`).join(' ');
  return `<html><head><title>T</title></head><body>
    <mdn-menu>${SHADOW_CSS}<nav>${nav}</nav></mdn-menu>
    <main><h1>Heading</h1><p>${main}</p></main>
    <script>window.analytics = { track: function () { return "page not found"; } };</script>
  </body></html>`;
}

describe('page text excludes code that never renders (ISSUE-006)', () => {
  beforeEach(() => resetNearDuplicateRegistry());

  it('bodyText drops script, style, noscript and inert templates, and keeps shadow-root text', () => {
    const html = `<html><body><p>Visible</p>
      <template shadowrootmode="open"><style>.x{color:red}</style><span>Shadow</span></template>
      <template><i>Inert</i></template><script>run()</script><noscript>Enable JS</noscript>
    </body></html>`;
    expect(bodyText(createTestContext(html).$)).toBe('Visible Shadow');
  });

  it('content-text-html-ratio measures visible text, not shadow-DOM CSS', async () => {
    const html = page('Short paragraph.');
    const result = await textHtmlRatioRule.run(createTestContext(html));
    expect(result.details?.textLength).toBe(bodyText(createTestContext(html).$).length);
    expect(String(result.details?.textLength)).not.toBe(String(createTestContext(html).$('body').text().replace(/\s+/g, ' ').trim().length));
  });

  it('content-duplicate-near compares main content, not shared navigation and CSS', async () => {
    const first = page('Elements are the building blocks of documents and each one has a purpose described here in detail.');
    const second = page('Attributes adjust how elements behave, and global attributes apply to every element in the language.');
    await duplicateNearRule.run(createTestContext(first, { url: 'https://example.com/a' }));
    const result = await duplicateNearRule.run(createTestContext(second, { url: 'https://example.com/b' }));
    expect(result.status).toBe('pass');
  });

  it('content-duplicate-near still flags pages whose main content is the same', async () => {
    const copy = 'This exact paragraph is published twice on the site with the same wording in both places so it is a duplicate of itself.';
    await duplicateNearRule.run(createTestContext(page(copy), { url: 'https://example.com/a' }));
    const result = await duplicateNearRule.run(createTestContext(page(copy), { url: 'https://example.com/b' }));
    expect(result.status).toBe('fail');
  });
});
