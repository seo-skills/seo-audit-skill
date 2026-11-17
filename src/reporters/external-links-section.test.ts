/**
 * Broken external links show once per target, with the pages that link to
 * it, in every report format.
 */
import { describe, it, expect, vi } from 'vitest';
import { renderMarkdownReport } from './markdown-reporter.js';
import { renderLlmReport } from './llm-reporter.js';
import { renderHtmlReport } from './html-reporter.js';
import { renderTerminalReport } from './terminal.js';
import type { AuditResult } from '../types.js';

const DEAD = 'https://partner.test/retired';

function result(): AuditResult {
  return {
    url: 'https://site.test/',
    overallScore: 88,
    timestamp: '2026-11-17T00:00:00.000Z',
    crawledPages: 12,
    categoryResults: [],
    extras: {
      externalLinks: {
        checked: 9,
        broken: 1,
        couldNotVerify: 2,
        notChecked: 0,
        fromCache: 0,
        brokenTargets: [
          {
            url: DEAD,
            status: 404,
            reason: 'HTTP 404',
            linkedFrom: ['https://site.test/a', 'https://site.test/b', 'https://site.test/c', 'https://site.test/d'],
            linkedFromCount: 12,
          },
        ],
        unverifiedTargets: [],
      },
    },
  };
}

describe('broken external links in reports', () => {
  it('markdown: one row for the target, three linking pages and the rest counted', () => {
    const md = renderMarkdownReport(result());
    expect(md).toContain('## Broken external links');
    // The reporter escapes markdown punctuation, dots included
    expect(md).toContain('| https://partner\\.test/retired | HTTP 404 |');
    expect(md).toContain('site\\.test/c, +9 more |');
    expect(md).toContain('Also: 2 could not be verified.');
  });

  it('llm: the target and its pages are wrapped as untrusted site text', () => {
    const xml = renderLlmReport(result());
    expect(xml).toMatch(/<broken-external-links count="1">/);
    expect(xml).toMatch(/<link answer="HTTP 404"><untrusted-[0-9a-f]+>https:\/\/partner\.test\/retired<\/untrusted-/);
  });

  it('html and terminal name the target', () => {
    expect(renderHtmlReport(result())).toContain('Broken external links (1)');
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    renderTerminalReport(result());
    const printed = log.mock.calls.flat().join('\n');
    log.mockRestore();
    expect(printed).toContain('BROKEN EXTERNAL LINKS (1)');
    expect(printed).toContain(DEAD);
    expect(printed).toContain('+9 more');
  });

  it('says nothing when no external link is broken', () => {
    const clean = result();
    (clean.extras!.externalLinks as { broken: number }).broken = 0;
    expect(renderMarkdownReport(clean)).not.toContain('Broken external links');
  });
});
