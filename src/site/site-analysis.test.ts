import { describe, it, expect } from 'vitest';
import * as cheerio from 'cheerio';
import '../rules/loader.js';
import { createTestSite, type TestPage } from '../rules/test-context.js';
import { titleUniqueRule } from '../rules/core/title-unique.js';
import { duplicateDescriptionRule } from '../rules/content/duplicate-description.js';
import { duplicateExactRule } from '../rules/content/duplicate-exact.js';
import { duplicateNearRule } from '../rules/content/duplicate-near.js';
import { duplicateH1Rule } from '../rules/content/duplicate-h1.js';
import { findNearDuplicates, jaccardSorted, shingleText } from './near-duplicates.js';
import { canonicalFromLinkHeader, isNoindex, isPaginatedPage, readCanonical } from '../indexability.js';

/** A deterministic pseudo-random generator, so the corpora are reproducible */
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state ^ (state >>> 15), 0x2c1b3c6d) + 0x9e3779b9) >>> 0;
    return state / 0xffffffff;
  };
}

const VOCABULARY = Array.from({ length: 4000 }, (_, i) => `w${i.toString(36)}`);

function words(random: () => number, count: number): string[] {
  return Array.from({ length: count }, () => VOCABULARY[Math.floor(random() * VOCABULARY.length)]);
}

describe('cross-page verdicts do not depend on page order', () => {
  it('scores every page the same whatever order the crawl recorded them in', async () => {
    const random = seeded(7);
    const shared = words(random, 300).join(' ');
    const pages: TestPage[] = Array.from({ length: 12 }, (_, i) => {
      const title = i % 3 === 0 ? 'Shared title' : `Title ${i}`;
      const description = i % 4 === 0 ? 'A shared description long enough to be compared across pages.' : `Description ${i} that is long enough to count as one.`;
      const body = i % 5 === 0 ? shared : words(random, 300).join(' ');
      return {
        url: `https://example.com/p${i}`,
        html: `<html><head><title>${title}</title><meta name="description" content="${description}"></head><body><h1>${i % 2 ? 'Same heading' : `Heading ${i}`}</h1><main><p>${body}</p></main></body></html>`,
      };
    });

    const verdicts = async (order: TestPage[]) => {
      const { contexts } = await createTestSite(order);
      const out: Record<string, string> = {};
      for (const page of pages) {
        for (const rule of [titleUniqueRule, duplicateDescriptionRule, duplicateExactRule, duplicateNearRule, duplicateH1Rule]) {
          const result = await rule.run(contexts.get(page.url)!);
          out[`${page.url} ${rule.id}`] = `${result.status}:${JSON.stringify(result.details?.duplicateUrls ?? result.details?.similarUrls ?? null)}`;
        }
      }
      return out;
    };

    const forward = await verdicts(pages);
    const reversed = await verdicts([...pages].reverse());
    const shuffled = await verdicts([...pages].sort((a, b) => (a.url.length * 7 + a.url.charCodeAt(a.url.length - 1)) % 5 - (b.url.length * 7 + b.url.charCodeAt(b.url.length - 1)) % 5));
    expect(reversed).toEqual(forward);
    expect(shuffled).toEqual(forward);
    expect(Object.values(forward).some((v) => v.startsWith('warn') || v.startsWith('fail'))).toBe(true);
  });
});

describe('near-duplicate detection', () => {
  it('keeps letters from every script, so a non-English page is not empty', () => {
    expect(shingleText('Türkçe sayfa içeriği burada yer alıyor ve devam ediyor').length).toBeGreaterThan(3);
    expect(shingleText('Ελληνικό κείμενο που συνεχίζεται εδώ για αρκετές λέξεις').length).toBeGreaterThan(3);
  });

  it('computes exact Jaccard by merging sorted arrays', () => {
    expect(jaccardSorted(Uint32Array.from([1, 2, 3]), Uint32Array.from([2, 3, 4]))).toBeCloseTo(0.5);
  });

  it('finds at least 99% of the pairs an exhaustive comparison finds at 0.6 and above', () => {
    const random = seeded(42);
    const templates = Array.from({ length: 10 }, () => words(random, 250));
    const pages = Array.from({ length: 600 }, (_, i) => {
      // 40 to 60% shared boilerplate from one of ten templates, the rest unique
      const template = templates[i % templates.length];
      const shareCount = 200 + Math.floor(random() * 100);
      const own = words(random, 500 - shareCount);
      return { url: `https://example.com/${i}`, shingles: shingleText([...template.slice(0, shareCount), ...own].join(' ')) };
    });
    // A few deliberate near-copies so the high end is populated
    for (let i = 0; i < 40; i++) {
      const source = pages[i].shingles;
      const kept = source.filter((_, index) => index % 10 !== 0);
      pages.push({ url: `https://example.com/copy-${i}`, shingles: Uint32Array.from(kept) });
    }

    const exhaustive = new Set<string>();
    for (let a = 0; a < pages.length; a++) {
      for (let b = a + 1; b < pages.length; b++) {
        if (jaccardSorted(pages[a].shingles, pages[b].shingles) >= 0.6) exhaustive.add(`${pages[a].url}|${pages[b].url}`);
      }
    }
    expect(exhaustive.size).toBeGreaterThan(30);

    const analysis = findNearDuplicates(pages, 0.6);
    if (analysis.kind !== 'compared') throw new Error('expected a comparison');
    let found = 0;
    for (const pair of exhaustive) {
      const [a, b] = pair.split('|');
      if (analysis.similar.get(a)?.some((p) => p.url === b)) found++;
    }
    expect(found / exhaustive.size).toBeGreaterThanOrEqual(0.99);
  });

  it('pairs identical pages at 1.0 and lists every member', () => {
    const text = 'one two three four five six seven eight nine ten eleven twelve';
    const result = findNearDuplicates(
      ['a', 'b', 'c'].map((name) => ({ url: `https://example.com/${name}`, shingles: shingleText(text) })),
      0.6
    );
    if (result.kind !== 'compared') throw new Error('expected a comparison');
    expect(result.similar.get('https://example.com/a')?.map((p) => [p.url, p.similarity])).toEqual([
      ['https://example.com/b', 1],
      ['https://example.com/c', 1],
    ]);
  });

  it('stops and says so when a crawl produces too many candidates', () => {
    const random = seeded(3);
    const base = words(random, 400);
    const pages = Array.from({ length: 60 }, (_, i) => ({
      url: `https://example.com/${i}`,
      shingles: shingleText([...base, ...words(random, 5)].join(' ')),
    }));
    expect(findNearDuplicates(pages, 0.6, 100).kind).toBe('too-many-candidates');
  });

  it.skipIf(!process.env['SEOMATOR_BENCH'])('compares 10,000 template-heavy pages in under 10 seconds', () => {
    const random = seeded(11);
    const templates = Array.from({ length: 50 }, () => words(random, 250));
    const pages = Array.from({ length: 10_000 }, (_, i) => ({
      url: `https://example.com/${i}`,
      shingles: shingleText([...templates[i % 50].slice(0, 200 + Math.floor(random() * 100)), ...words(random, 250)].join(' ')),
    }));
    const started = performance.now();
    const result = findNearDuplicates(pages, 0.6);
    expect(result.kind).toBe('compared');
    expect(performance.now() - started).toBeLessThan(10_000);
  });
});

describe('indexability classifier', () => {
  const page = (head: string, headers: Record<string, string> = {}, url = 'https://example.com/a') => ({
    $: cheerio.load(`<html><head>${head}</head><body></body></html>`),
    headers,
    url,
  });

  it('reads googlebot meta and Google-scoped X-Robots-Tag, but not another engine', () => {
    expect(isNoindex(page('<meta name="googlebot" content="noindex">'))).toBe(true);
    expect(isNoindex(page('', { 'x-robots-tag': 'googlebot: noindex' }))).toBe(true);
    expect(isNoindex(page('', { 'x-robots-tag': 'bingbot: noindex' }))).toBe(false);
  });

  it('takes the canonical from the element, then the HTTP Link header', () => {
    expect(readCanonical(page('<link rel="canonical" href="/b">'))).toBe('https://example.com/b');
    expect(readCanonical(page('', { link: '<https://example.com/c>; rel="canonical"' }))).toBe('https://example.com/c');
    expect(canonicalFromLinkHeader('<https://x.com/a>; rel="preload", <https://x.com/b>; rel=canonical', 'https://x.com/')).toBe(
      'https://x.com/b'
    );
    expect(readCanonical(page(''))).toBeUndefined();
  });

  it('treats a later page of a series as paginated, not the first', () => {
    expect(isPaginatedPage(page('', {}, 'https://example.com/blog/page/2'))).toBe(true);
    expect(isPaginatedPage(page('', {}, 'https://example.com/list?page=3'))).toBe(true);
    expect(isPaginatedPage(page('<link rel="prev" href="/blog">'))).toBe(true);
    expect(isPaginatedPage(page('<link rel="next" href="/blog/page/2">'))).toBe(false);
    expect(isPaginatedPage(page('', {}, 'https://example.com/products/12345'))).toBe(false);
  });
});
