/**
 * Page-level score caps: reading the facts, the policy, applying ceilings.
 *
 * The score ladder (`score-ladder.test.ts`) checks the end result through the
 * whole engine. These tests pin each part on its own, above all the places a
 * mistake would cap a page that should not be capped — the expensive
 * direction, since a cap overrides everything else the audit found.
 */
import { describe, it, expect } from 'vitest';
import * as cheerio from 'cheerio';
import { createTestContext } from './rules/test-context.js';
import {
  readPageFacts,
  applyScoreCaps,
  pageCaps,
  siteCaps,
  indexabilityCaps,
  contentCaps,
  type PageFacts,
} from './score-caps.js';
import type { AuditResult, ScoreCap } from './types.js';

const BODY = '<body><main><p>Five words of main content.</p></main></body>';
const page = (head = '') => `<html><head>${head}</head>${BODY}</html>`;

describe('reading noindex', () => {
  it.each([
    ['robots meta', page('<meta name="robots" content="noindex, follow">')],
    ['googlebot meta', page('<meta name="googlebot" content="noindex">')],
    ['"none", which includes noindex', page('<meta name="robots" content="none">')],
    ['an upper-case meta name', page('<meta name="ROBOTS" content="NOINDEX">')],
  ])('sees %s', (_label, html) => {
    expect(readPageFacts(createTestContext(html)).noindex).toBe(true);
  });

  it('ignores a meta tag addressed to another crawler', () => {
    const html = page('<meta name="bingbot" content="noindex">');
    expect(readPageFacts(createTestContext(html)).noindex).toBe(false);
  });

  it.each([
    ['noindex', true],
    ['noindex, nofollow', true],
    ['googlebot: noindex', true],
    ['max-snippet: 20, noindex', true],
    ['bingbot: noindex', false],
    // The directives after a crawler prefix are that crawler's
    ['bingbot: nofollow, noindex', false],
    ['bingbot: noindex, googlebot: nofollow', false],
    ['nofollow, noarchive', false],
    ['', false],
  ])('reads X-Robots-Tag "%s" as noindex=%s', (value, expected) => {
    const context = createTestContext(page(), { headers: { 'x-robots-tag': value } });
    expect(readPageFacts(context).noindex).toBe(expected);
  });
});

describe('reading robots.txt', () => {
  const at = (robotsTxtContent: string | undefined, url = 'https://example.com/private/page') =>
    readPageFacts(createTestContext(page(), { url, robotsTxtContent })).robotsDisallowed;

  it('sees a Disallow that covers the page', () => {
    expect(at('User-agent: *\nDisallow: /private/')).toBe(true);
  });

  it('follows the Googlebot group over the * group', () => {
    expect(at('User-agent: *\nDisallow: /\n\nUser-agent: Googlebot\nAllow: /')).toBe(false);
  });

  it('lets a longer Allow win', () => {
    expect(at('User-agent: *\nDisallow: /private/\nAllow: /private/page')).toBe(false);
  });

  it('treats a missing robots.txt as allowing everything', () => {
    expect(at(undefined)).toBe(false);
    expect(at('')).toBe(false);
  });
});

describe('reading the title and the content', () => {
  it('counts a whitespace-only title as no title', () => {
    expect(readPageFacts(createTestContext(page('<title>  </title>'))).hasTitle).toBe(false);
    expect(readPageFacts(createTestContext(page('<title>Widgets</title>'))).hasTitle).toBe(true);
  });

  it('ignores an SVG title, as the title rules do', () => {
    const html = '<html><head></head><body><svg><title>Icon</title></svg></body></html>';
    expect(readPageFacts(createTestContext(html)).hasTitle).toBe(false);
  });

  it('counts main content only', () => {
    const html = '<html><body><nav>Home About Contact Pricing Blog</nav><main><p>Five words of main content.</p></main><footer>© 2026 Acme Supply Ltd</footer></body></html>';
    expect(readPageFacts(createTestContext(html)).mainContentWords).toBe(5);
  });

  const SHELL = '<html><head><title>App</title></head><body><div id="root"></div><script src="/app.js"></script></body></html>';

  it('does not count the words of an app shell nobody rendered', () => {
    // Google renders it; reading it as empty would cap a page the audit
    // simply did not read.
    expect(readPageFacts(createTestContext(SHELL)).mainContentWords).toBeNull();
  });

  it('counts the rendered DOM when the audit rendered the page', () => {
    const rendered = cheerio.load('<html><head><title>App</title></head><body><div id="root"><main><p>Rendered by the framework in the browser.</p></main></div></body></html>');
    const facts = readPageFacts(createTestContext(SHELL, { rendered$: rendered }));
    expect(facts.mainContentWords).toBe(7);
  });

  it('counts a server-rendered app normally', () => {
    const html = '<html><head><title>App</title></head><body><div id="__next"><main><p>Server rendered words are already in the HTML here.</p></main><footer>x</footer></div></body></html>';
    expect(readPageFacts(createTestContext(html)).mainContentWords).toBe(9);
  });
});

const facts = (over: Partial<PageFacts> = {}): PageFacts => ({
  noindex: false,
  robotsDisallowed: false,
  hasTitle: true,
  mainContentWords: 500,
  ...over,
});
const ids = (caps: ScoreCap[]) => caps.map((cap) => `${cap.id}:${cap.ceiling}`);

describe('the cap policy for a page', () => {
  const applied = (f: PageFacts) => ids(pageCaps(f).caps);

  it('caps nothing on a complete page', () => {
    expect(pageCaps(facts())).toEqual({ caps: [], waived: [] });
  });

  it('holds an unindexable page in the F band', () => {
    expect(applied(facts({ noindex: true }))).toEqual(['noindex:20']);
    expect(applied(facts({ robotsDisallowed: true }))).toEqual(['robots-disallowed:20']);
  });

  it('names an empty page once, not three times', () => {
    expect(applied(facts({ hasTitle: false, mainContentWords: 1 }))).toEqual(['empty-page:30']);
  });

  it('ranks the content and title caps by what they leave to index', () => {
    expect(applied(facts({ mainContentWords: 4 }))).toEqual(['thin-content:49']);
    expect(applied(facts({ hasTitle: false }))).toEqual(['no-title:69']);
  });

  it('leaves an ordinary short page alone', () => {
    // The baseline fixture is an ordinary page with 80 words of main content
    expect(applied(facts({ mainContentWords: 80 }))).toEqual([]);
    expect(applied(facts({ mainContentWords: 20 }))).toEqual([]);
  });

  it('does not cap content it could not count', () => {
    expect(applied(facts({ mainContentWords: null }))).toEqual([]);
    expect(applied(facts({ mainContentWords: null, hasTitle: false }))).toEqual(['no-title:69']);
  });

  it('keeps independent conditions apart', () => {
    expect(applied(facts({ noindex: true, hasTitle: false }))).toEqual(['noindex:20', 'no-title:69']);
  });

  it('writes a reason that names the count', () => {
    expect(contentCaps(facts({ mainContentWords: 1 }))[0].reason).toContain('1 word of main content');
    expect(contentCaps(facts({ mainContentWords: 4 }))[0].reason).toContain('4 words of main content');
  });

  it('points a blocked page at --staging', () => {
    expect(indexabilityCaps(facts({ noindex: true }))[0].reason).toContain('audit it with --staging');
  });
});

describe('staging', () => {
  it('waives the indexability caps and records them', () => {
    const set = pageCaps(facts({ noindex: true, robotsDisallowed: true }), { staging: true });
    expect(set.caps).toEqual([]);
    expect(ids(set.waived)).toEqual(['noindex:20', 'robots-disallowed:20']);
  });

  it('turns the reason into a launch reminder', () => {
    const [noindex, robots] = pageCaps(facts({ noindex: true, robotsDisallowed: true }), { staging: true }).waived;
    expect(noindex.reason).toContain('Remove it at launch');
    expect(noindex.reason).not.toContain('--staging');
    expect(robots.reason).toContain('at launch');
  });

  it('keeps the content caps: an empty staging page is still empty', () => {
    const set = pageCaps(facts({ noindex: true, hasTitle: false, mainContentWords: 1 }), { staging: true });
    expect(ids(set.caps)).toEqual(['empty-page:30']);
    expect(ids(set.waived)).toEqual(['noindex:20']);
  });
});

describe('the cap policy for a crawl', () => {
  const START = 'https://example.com/';

  it('caps the site when its start page cannot be indexed, and names the page', () => {
    const { caps } = siteCaps(facts({ noindex: true }), START);
    expect(ids(caps)).toEqual(['noindex:20']);
    expect(caps[0].reason).toContain(`keeps the start page (${START}) out of Google's index`);
  });

  it('reads cleanly for a robots.txt block', () => {
    const { caps } = siteCaps(facts({ robotsDisallowed: true }), START);
    expect(caps[0].reason).toContain(`blocks Googlebot from fetching the start page (${START}), so`);
  });

  it('leaves content to the per-page scores', () => {
    // Every page's title and words already count in the category averages;
    // only an indexability block at the entry point is site-wide.
    expect(siteCaps(facts({ hasTitle: false, mainContentWords: 1 }), START)).toEqual({ caps: [], waived: [] });
  });

  it('waives a staging site', () => {
    const set = siteCaps(facts({ noindex: true }), START, { staging: true });
    expect(set.caps).toEqual([]);
    expect(ids(set.waived)).toEqual(['noindex:20']);
  });
});

describe('applying caps', () => {
  const result = (overallScore: number): AuditResult => ({
    url: 'https://example.com/',
    overallScore,
    categoryResults: [],
    timestamp: '2026-10-15T00:00:00.000Z',
    crawledPages: 1,
  });
  const cap = (id: string, ceiling: number): ScoreCap => ({ id, ceiling, reason: `${id} holds` });
  const only = (caps: ScoreCap[]) => ({ caps, waived: [] });

  it('leaves the result alone when no cap applies', () => {
    expect(applyScoreCaps(result(94), only([]))).toEqual(result(94));
  });

  it('holds the score at the lowest ceiling and records the average', () => {
    const capped = applyScoreCaps(result(94), only([cap('no-title', 49), cap('noindex', 20)]));
    expect(capped.overallScore).toBe(20);
    expect(capped.scoreCap).toEqual({
      uncappedScore: 94,
      caps: [cap('noindex', 20), cap('no-title', 49)],
    });
  });

  it('records only the caps that lowered the score', () => {
    // A page averaging 40 is already under a ceiling of 49; saying it was
    // capped there would claim the cap did something.
    const capped = applyScoreCaps(result(40), only([cap('no-title', 49), cap('noindex', 20)]));
    expect(capped.overallScore).toBe(20);
    expect(capped.scoreCap?.caps.map((c) => c.id)).toEqual(['noindex']);
  });

  it('is not a cap when the score already sits at or under every ceiling', () => {
    expect(applyScoreCaps(result(20), only([cap('noindex', 20)]))).toEqual(result(20));
  });

  it('records waived caps without touching the score', () => {
    const staged = applyScoreCaps(result(94), { caps: [], waived: [cap('noindex', 20)] });
    expect(staged.overallScore).toBe(94);
    expect(staged.scoreCap).toBeUndefined();
    expect(staged.waivedCaps).toEqual([cap('noindex', 20)]);
  });
});
