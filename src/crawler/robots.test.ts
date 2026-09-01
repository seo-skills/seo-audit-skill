import { describe, it, expect } from 'vitest';
import { RobotsMatcher, parseRobotsTxt } from './robots.js';

/**
 * Regression: ISSUE-013 — the crawler ignored robots.txt entirely
 * Found by /qa on 2026-09-01
 * Report: .gstack/qa-reports/qa-report-seomator-deep-2026-09-01.md
 *
 * respect_robots was declared, defaulted to true, validated, and read by
 * nothing, so a crawl fetched paths the site had disallowed.
 */
const UA = 'SEOmator/3.2.0';

const allowed = (content: string, url: string, ua = UA): boolean =>
  new RobotsMatcher(content, ua).isAllowed(url);

const U = (path: string): string => `https://example.com${path}`;

describe('RobotsMatcher', () => {
  it('allows everything when there is no robots.txt', () => {
    expect(allowed('', U('/anything'))).toBe(true);
  });

  it('blocks a disallowed prefix', () => {
    const txt = 'User-agent: *\nDisallow: /blocked\n';
    expect(allowed(txt, U('/blocked'))).toBe(false);
    expect(allowed(txt, U('/blocked/deeper'))).toBe(false);
    expect(allowed(txt, U('/public'))).toBe(true);
  });

  it('treats an empty Disallow as permitting everything', () => {
    expect(allowed('User-agent: *\nDisallow:\n', U('/anything'))).toBe(true);
  });

  it('lets a more specific Allow override a broader Disallow', () => {
    const txt = 'User-agent: *\nDisallow: /admin\nAllow: /admin/public\n';
    expect(allowed(txt, U('/admin/secret'))).toBe(false);
    expect(allowed(txt, U('/admin/public/page'))).toBe(true);
  });

  it('prefers Allow when Allow and Disallow match with equal specificity', () => {
    const txt = 'User-agent: *\nDisallow: /x\nAllow: /x\n';
    expect(allowed(txt, U('/x'))).toBe(true);
  });

  it('honours * wildcards inside a pattern', () => {
    const txt = 'User-agent: *\nDisallow: /*.pdf\n';
    expect(allowed(txt, U('/files/report.pdf'))).toBe(false);
    expect(allowed(txt, U('/files/report.html'))).toBe(true);
  });

  it('honours $ as an end anchor', () => {
    const txt = 'User-agent: *\nDisallow: /page$\n';
    expect(allowed(txt, U('/page'))).toBe(false);
    expect(allowed(txt, U('/page/child'))).toBe(true);
  });

  it('matches against the query string too', () => {
    const txt = 'User-agent: *\nDisallow: /*?session=\n';
    expect(allowed(txt, U('/p?session=abc'))).toBe(false);
    expect(allowed(txt, U('/p?page=2'))).toBe(true);
  });

  it('treats pattern punctuation literally, not as regex', () => {
    const txt = 'User-agent: *\nDisallow: /a+b(c)\n';
    expect(allowed(txt, U('/a+b(c)'))).toBe(false);
    expect(allowed(txt, U('/aaab'))).toBe(true);
  });

  it('applies a group naming this crawler over the wildcard group', () => {
    const txt = 'User-agent: *\nDisallow: /\n\nUser-agent: SEOmator\nDisallow: /private\n';
    expect(allowed(txt, U('/public'))).toBe(true);
    expect(allowed(txt, U('/private'))).toBe(false);
  });

  it('falls back to the wildcard group for an unnamed crawler', () => {
    const txt = 'User-agent: Googlebot\nDisallow:\n\nUser-agent: *\nDisallow: /nope\n';
    expect(allowed(txt, U('/nope'))).toBe(false);
  });

  it('ignores comments and blank lines', () => {
    const txt = '# a comment\n\nUser-agent: *   # trailing\nDisallow: /x  # here\n';
    expect(allowed(txt, U('/x'))).toBe(false);
  });

  it('is case-insensitive on field names and agent tokens', () => {
    const txt = 'USER-AGENT: seomator\nDISALLOW: /nope\n';
    expect(allowed(txt, U('/nope'))).toBe(false);
  });

  it('applies consecutive User-agent lines to one shared group', () => {
    const txt = 'User-agent: bingbot\nUser-agent: seomator\nDisallow: /shared\n';
    expect(allowed(txt, U('/shared'))).toBe(false);
  });

  it('allows a malformed URL rather than blocking on it', () => {
    expect(allowed('User-agent: *\nDisallow: /\n', 'not a url')).toBe(true);
  });
});

describe('parseRobotsTxt', () => {
  it('collects rules per group', () => {
    const groups = parseRobotsTxt('User-agent: a\nDisallow: /1\n\nUser-agent: b\nAllow: /2\n');
    expect(groups).toHaveLength(2);
    expect(groups[0]!.agents).toEqual(['a']);
    expect(groups[1]!.rules[0]!.allow).toBe(true);
  });

  it('ignores lines that are not field:value', () => {
    expect(parseRobotsTxt('garbage line\nUser-agent: *\nDisallow: /x\n')).toHaveLength(1);
  });
});
