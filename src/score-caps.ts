/**
 * Page-level score caps.
 *
 * The overall score is a weighted average of twenty categories, and most of
 * that weight sits in checks that read the same on every page of a server:
 * headers, TLS, compression, URL shape. An average cannot say "nothing else
 * matters". A page search engines are told not to index scored 94/100, and a
 * page holding one word scored 85 — a B — because the server around it was
 * well configured. Fixing individual rules cannot change that: `core`, where
 * the title and the indexing directives live, carries 11% of the weight, so
 * even a zero there moves the overall score by at most eleven points.
 *
 * A cap is the missing operator. While a condition holds that no amount of
 * on-page work outweighs, the overall score is held at or below a ceiling,
 * and the result records which condition and what the average would have
 * been. Category scores are untouched; they still describe what was measured.
 *
 * A single-page audit is capped by its own page. A crawl is capped by its
 * start page only, and only when search engines cannot index it: one noindex
 * page among fifty is usually deliberate, a noindex start page is not. A
 * staging audit waives the indexability caps and records them instead.
 */
import type { AuditContext, AuditResult, ScoreCap } from './types.js';
import { parseRobotsDirectives } from './rules/core/robots-meta.js';
import { DOCUMENT_TITLE } from './rules/document-title.js';
import { extractMainContent, countWords } from './rules/content/utils/text-extractor.js';
import { RobotsMatcher } from './crawler/robots.js';

/** What the caps decide on, read once from the fetched page */
export interface PageFacts {
  /** A robots meta tag or X-Robots-Tag tells Google not to index the page */
  noindex: boolean;
  /** robots.txt forbids Googlebot from fetching the page */
  robotsDisallowed: boolean;
  /** The document has a non-empty `<title>` */
  hasTitle: boolean;
  /**
   * Words of main content, counted the way `content-word-count` counts them.
   * `null` when they could not be counted: the page is a client-rendered app
   * shell and the audit did not render it.
   */
  mainContentWords: number | null;
}

/**
 * Mount points of client-rendering frameworks, as `js-ssr-check` reads them.
 * Kept in step with that rule by hand: it is a rule file, this is not.
 */
const APP_ROOTS = ['#root', '#app', '#__next', '#__nuxt', '#__svelte'];

/**
 * Whether the served HTML is an empty shell a framework fills in the browser.
 *
 * Without a render, such a page reads as empty to the audit. Google renders
 * it, so capping it as contentless would fail a page the audit simply did not
 * read — the expensive direction for a cap to be wrong in.
 */
function isAppShell($: AuditContext['$']): boolean {
  return APP_ROOTS.some((selector) => {
    const root = $(selector);
    return root.length > 0 && root.text().trim().length < 50 && root.children().length <= 2;
  });
}

/**
 * Directives written `name: value`. Inside an X-Robots-Tag they look like a
 * user-agent prefix and must not be read as one.
 */
const VALUED_DIRECTIVES = new Set([
  'max-snippet',
  'max-image-preview',
  'max-video-preview',
  'unavailable_after',
]);

/**
 * Whether Google is told not to index the page.
 *
 * Reads the `robots` and `googlebot` meta tags, and the X-Robots-Tag header.
 * A header segment prefixed with a crawler name applies to that crawler, and
 * so do the segments after it: in `bingbot: nofollow, noindex` both
 * directives are Bing's. Only unprefixed and `googlebot:` directives count,
 * because a cap from another engine's directive would mark down a page
 * Google indexes.
 */
function hasGoogleNoindex({ $, headers }: AuditContext): boolean {
  const tokens: string[] = [];

  $('meta[name="robots" i], meta[name="googlebot" i]').each((_, el) => {
    tokens.push(...parseRobotsDirectives($(el).attr('content') ?? ''));
  });

  let agent: string | null = null; // null: the directive applies to every crawler
  for (const segment of (headers['x-robots-tag'] ?? '').split(',')) {
    let directive = segment;
    const prefixed = /^\s*([a-z][a-z0-9_-]*)\s*:(.*)$/i.exec(segment);
    if (prefixed && !VALUED_DIRECTIVES.has(prefixed[1].toLowerCase())) {
      agent = prefixed[1].toLowerCase();
      directive = prefixed[2];
    }
    if (agent === null || agent === 'googlebot') {
      tokens.push(...parseRobotsDirectives(directive));
    }
  }

  return tokens.includes('noindex') || tokens.includes('none');
}

/**
 * Read the facts the caps decide on.
 *
 * Read from the page, not from rule results, so a cap holds even when
 * `rules.disable` turns off the rule that would have reported it. The title
 * and the content come from the rendered DOM when the audit rendered the
 * page, because that is what Google indexes; directives come from the served
 * HTML and headers, which Google reads before it decides to render.
 */
export function readPageFacts(context: AuditContext): PageFacts {
  const { $, url } = context;
  const page = context.rendered$ ?? $;
  const unread = !context.rendered$ && isAppShell($);
  return {
    noindex: hasGoogleNoindex(context),
    robotsDisallowed: !new RobotsMatcher(context.robotsTxtContent ?? '', 'Googlebot').isAllowed(url),
    hasTitle: page(DOCUMENT_TITLE).first().text().trim().length > 0,
    mainContentWords: unread ? null : countWords(extractMainContent(page)),
  };
}

/** Below this many words of main content, a page has nothing to be found for */
const MIN_CONTENT_WORDS = 20;

const words = (n: number) => `${n} ${n === 1 ? 'word' : 'words'}`;

/*
 * The policy: which conditions outweigh everything else, and how far each
 * holds the score down. Severity follows what the condition leaves a search
 * engine to work with. The verdict bands are A ≥ 90, B ≥ 80, C ≥ 70, D ≥ 50,
 * F below, and `audit` exits 1 below 70, so every one of these fails a CI run.
 *
 * | Cap               | Ceiling | The page...                                  |
 * |-------------------|---------|----------------------------------------------|
 * | noindex           | 20      | is kept out of the index                     |
 * | robots-disallowed | 20      | cannot be fetched by Googlebot               |
 * | empty-page        | 30      | has no title and almost no content           |
 * | thin-content      | 49      | has almost no content to match a query to    |
 * | no-title          | 69      | has no headline; search engines write one    |
 *
 * The first two are indexability: the page is kept out of search. The rest
 * are content: the page is in search with nothing to be found for. The split
 * matters twice. A staging site is kept out of search on purpose, so staging
 * waives indexability and keeps content. And a crawl is capped by
 * indexability alone, read from its start page — every page's content is
 * already scored, but only the entry point shows a site-wide block.
 */

/**
 * Caps for a page search engines are told, or kept, from indexing.
 *
 * The reason ends with what to do: in production, point a staging site at
 * `--staging`; in staging, where the cap is waived, lift it at launch.
 *
 * @param facts - What was read from the page
 * @param subject - How the reason names the page
 * @param staging - Whether the caps are being waived for a staging site
 */
export function indexabilityCaps(facts: PageFacts, subject = 'this page', staging = false): ScoreCap[] {
  const caps: ScoreCap[] = [];
  if (facts.noindex) {
    caps.push({
      id: 'noindex',
      ceiling: 20,
      reason:
        `A noindex directive (robots meta tag or X-Robots-Tag) keeps ${subject} out of Google's index. ` +
        (staging ? 'Remove it at launch.' : 'On a staging site that is expected: audit it with --staging.'),
    });
  }
  if (facts.robotsDisallowed) {
    caps.push({
      id: 'robots-disallowed',
      ceiling: 20,
      reason:
        `robots.txt blocks Googlebot from fetching ${subject}, so search engines cannot read its content. ` +
        (staging
          ? 'Remove the Disallow rule that matches it at launch.'
          : 'Remove or narrow the Disallow rule that matches it, or audit a staging site with --staging.'),
    });
  }
  return caps;
}

/**
 * Caps for a page that gives a search engine nothing to be found for.
 *
 * "Almost no content" is fewer than 20 words, far below the 100 at which
 * `content-word-count` fails. Google sets no minimum length, and an ordinary
 * short page — a contact page, the baseline fixture's 80 words — must not be
 * capped. A page whose words could not be counted gets no content cap.
 *
 * @param facts - What was read from the page
 */
export function contentCaps(facts: PageFacts): ScoreCap[] {
  const caps: ScoreCap[] = [];
  const count = facts.mainContentWords;
  const thin = count !== null && count < MIN_CONTENT_WORDS;

  // One content cap, the most specific: an empty page is also untitled and
  // thin, and listing all three would say the same thing three times.
  if (thin && !facts.hasTitle) {
    caps.push({
      id: 'empty-page',
      ceiling: 30,
      reason: `The page has no <title> and ${words(count)} of main content: nothing for a search engine to index.`,
    });
  } else if (thin) {
    caps.push({
      id: 'thin-content',
      ceiling: 49,
      reason: `The page has ${words(count)} of main content: too little for a search engine to match to any query.`,
    });
  } else if (!facts.hasTitle) {
    caps.push({
      id: 'no-title',
      ceiling: 69,
      reason: 'The page has no <title>, which search engines use as the headline of its result; they will write one of their own.',
    });
  }

  return caps;
}

/** Whether the site is a staging site, blocked from search on purpose */
export interface CapOptions {
  staging?: boolean;
}

/** The caps that hold a score down, and those staging waived */
export interface CapSet {
  caps: ScoreCap[];
  waived: ScoreCap[];
}

/**
 * The caps a page imposes on its own score.
 *
 * @param facts - What was read from the page
 * @param options - `staging` waives the indexability caps
 */
export function pageCaps(facts: PageFacts, { staging = false }: CapOptions = {}): CapSet {
  const blocked = indexabilityCaps(facts, 'this page', staging);
  return staging
    ? { caps: contentCaps(facts), waived: blocked }
    : { caps: [...blocked, ...contentCaps(facts)], waived: [] };
}

/**
 * The caps a crawl's start page imposes on the whole site's score.
 *
 * Indexability only. A site-wide block — noindex shipped from staging,
 * `Disallow: /` — always reaches the start page, while a page kept out of
 * search on purpose (a login, a thank-you page) almost never is the start
 * page. Capping on any page would mark down every site with one of those.
 *
 * @param facts - What was read from the start page
 * @param url - The start page's URL, named in the reason
 * @param options - `staging` waives the caps
 */
export function siteCaps(facts: PageFacts, url: string, { staging = false }: CapOptions = {}): CapSet {
  const blocked = indexabilityCaps(facts, `the start page (${url})`, staging);
  return staging ? { caps: [], waived: blocked } : { caps: blocked, waived: [] };
}

/**
 * Hold the overall score at the lowest applicable ceiling.
 *
 * Only caps below the weighted average are recorded: a ceiling the page
 * already scores under changed nothing, and listing it would read as though
 * it had. Waived caps are recorded whatever the score, as a reminder of what
 * to lift at launch.
 *
 * @param result - The audit result with its weighted-average score
 * @param capSet - From {@link pageCaps} or {@link siteCaps}
 * @returns The result, capped and annotated when any cap binds
 */
export function applyScoreCaps(result: AuditResult, { caps, waived }: CapSet): AuditResult {
  const binding = caps
    .filter((cap) => cap.ceiling < result.overallScore)
    .sort((a, b) => a.ceiling - b.ceiling);
  const annotated = waived.length > 0 ? { ...result, waivedCaps: waived } : result;
  if (binding.length === 0) return annotated;

  return {
    ...annotated,
    overallScore: binding[0].ceiling,
    scoreCap: { uncappedScore: result.overallScore, caps: binding },
  };
}
