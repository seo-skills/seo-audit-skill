// Regression: ISSUE-020 — three head checks inspected a tree the parser had already repaired
// Found by /qa on 2026-10-15
// Report: .gstack/qa-reports/run-20261015T075717Z/qa-report-developer-mozilla-org-2026-10-15.md
//
// Cheerio parses with parse5, which follows the HTML spec: a <div> in <head>
// closes the head and moves to <body>, a second <head> is dropped, and
// <noscript> content is kept as text. htmlval-invalid-head,
// -noscript-in-head and -multiple-heads read that repaired tree, so none of
// them could ever find what it checks for.
import { describe, it, expect } from 'vitest';
import { createTestContext } from '../test-context.js';
import { invalidHeadRule } from './invalid-head.js';
import { noscriptInHeadRule } from './noscript-in-head.js';
import { multipleHeadsRule } from './multiple-heads.js';

const ctx = (html: string) => createTestContext(html);

describe('htmlval head checks read the source (ISSUE-020)', () => {
  it('htmlval-invalid-head finds body elements written inside <head>', async () => {
    const result = await invalidHeadRule.run(ctx('<html><head><title>x</title><div>bad</div></head><body></body></html>'));
    expect(result.status).toBe('warn');
    expect(result.details?.invalidElements).toEqual(['div']);
  });

  it('htmlval-invalid-head ignores markup inside scripts, comments and noscript', async () => {
    const html = `<html><head><title>x</title>
      <script>document.write("<div>later</div>")</script>
      <!-- <p>commented out</p> -->
      <noscript><img src="/pixel.gif"></noscript>
    </head><body><header><div>fine</div></header></body></html>`;
    expect((await invalidHeadRule.run(ctx(html))).status).toBe('pass');
  });

  it('htmlval-noscript-in-head finds an <img> in a head <noscript>', async () => {
    const html = '<html><head><noscript><img src="/pixel.gif"></noscript></head><body></body></html>';
    const result = await noscriptInHeadRule.run(ctx(html));
    expect(result.status).toBe('warn');
    expect(result.details?.invalidElements).toEqual(['img']);
  });

  it('htmlval-noscript-in-head passes permitted elements', async () => {
    const html = '<html><head><noscript><link rel="stylesheet" href="/x.css"><style>a{}</style></noscript></head><body></body></html>';
    expect((await noscriptInHeadRule.run(ctx(html))).status).toBe('pass');
  });

  it('htmlval-multiple-heads counts <head> start tags in the source', async () => {
    const html = '<html><head><title>a</title></head><head><meta charset="utf-8"></head><body></body></html>';
    const result = await multipleHeadsRule.run(ctx(html));
    expect(result.status).toBe('fail');
    expect(result.details?.count).toBe(2);
  });

  it('htmlval-multiple-heads does not count <header> or a commented-out <head>', async () => {
    const html = '<html><head><title>a</title></head><!-- <head> --><body><header></header></body></html>';
    expect((await multipleHeadsRule.run(ctx(html))).status).toBe('pass');
  });
});
