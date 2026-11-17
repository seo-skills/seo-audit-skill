/**
 * Internal Link Score: which pages the site's own links favour, 0 to 100.
 *
 * PageRank over the crawl's internal links, rescaled on a log curve so the
 * best-linked page scores 100 and a page only the random jump reaches scores
 * 0. A metric, not a rule: it changes no score and no ranking.
 */
import type { SiteContext } from '../types.js';
import { pageEligibility } from './groups.js';

const DAMPING = 0.85;
const TOLERANCE = 1e-6;
const MAX_ITERATIONS = 50;
/** "Every page has the same PageRank", allowing for floating-point drift */
const SAME_RANK = 1e-9;

/** The URL a key finally resolves to, following recorded redirects */
function resolver(site: SiteContext): (key: string) => string {
  const redirects = site.redirectTargetByUrl;
  return (key) => {
    let current = key;
    for (let hops = 0; redirects && hops < 10; hops++) {
      const next = redirects.get(current);
      if (!next || next === current) break;
      current = next;
    }
    return current;
  };
}

/**
 * Link Score per page, keyed by the site's normalised URL.
 *
 * Nodes are crawled pages answering 200, each under its final URL, so an
 * alias reached through a redirect never adds a node. A canonicalised page
 * passes everything to its canonical through one link. Nofollow links count
 * in the linking page's out-degree and pass nothing. Links to URLs that are
 * not nodes are dropped; a page with no links left spreads its score evenly.
 */
export function computeLinkScores(site: SiteContext): Map<string, number> {
  const resolve = resolver(site);
  const index = new Map<string, number>();
  const urls: string[] = [];
  for (const [key, info] of site.pages ?? []) {
    if (info.statusCode !== 200 || info.rateLimited) continue;
    const node = resolve(key);
    if (!index.has(node)) {
      index.set(node, urls.length);
      urls.push(node);
    }
  }
  const n = urls.length;
  if (n === 0) return new Map();

  // Out-links per node: followed targets, and how many links count in all
  const followed: number[][] = Array.from({ length: n }, () => []);
  const outDegree = new Float64Array(n);
  const canonicalised = new Set<number>();
  for (const [key, info] of site.pages ?? []) {
    const from = index.get(resolve(key));
    if (from === undefined || !info.canonical) continue;
    let target: number | undefined;
    try {
      target = index.get(resolve(site.normalize(info.canonical)));
    } catch {
      continue;
    }
    if (target === undefined || target === from) continue;
    canonicalised.add(from);
    followed[from] = [target];
    outDegree[from] = 1;
  }
  for (const [to, edges] of site.inboundEdgesByUrl ?? []) {
    const target = index.get(resolve(to));
    if (target === undefined) continue;
    for (const edge of edges) {
      const from = index.get(resolve(edge.from));
      if (from === undefined || from === target || canonicalised.has(from)) continue;
      outDegree[from]++;
      if (!edge.nofollow) followed[from].push(target);
    }
  }

  let rank = new Float64Array(n).fill(1 / n);
  let next = new Float64Array(n);
  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    let dangling = 0;
    for (let i = 0; i < n; i++) if (outDegree[i] === 0) dangling += rank[i];
    next.fill((1 - DAMPING) / n + (DAMPING * dangling) / n);
    for (let i = 0; i < n; i++) {
      if (outDegree[i] === 0) continue;
      const share = (DAMPING * rank[i]) / outDegree[i];
      for (const target of followed[i]) next[target] += share;
    }
    let change = 0;
    for (let i = 0; i < n; i++) change += Math.abs(next[i] - rank[i]);
    [rank, next] = [next, rank];
    if (change < TOLERANCE) break;
  }

  const scores = new Map<string, number>();
  let max = -Infinity;
  let min = Infinity;
  for (const value of rank) {
    max = Math.max(max, value);
    min = Math.min(min, value);
  }
  const floor = (1 - DAMPING) / n;
  const flat = n === 1 || max - min <= SAME_RANK;
  urls.forEach((url, i) => {
    const raw = flat ? 100 : (100 * Math.log(rank[i] / floor)) / Math.log(max / floor);
    scores.set(url, Math.round(Math.min(100, Math.max(0, raw)) * 10) / 10);
  });
  return scores;
}

export interface LinkScoreSummary {
  pages: number;
  top: Array<{ url: string; score: number }>;
  /** The lowest-scoring pages a search engine would index */
  lowestIndexable: Array<{ url: string; score: number }>;
}

/** The ten best-linked pages, and the ten weakest that should be found */
export function linkScoreSummary(site: SiteContext, scores: Map<string, number>, size = 10): LinkScoreSummary {
  const ranked = [...scores].map(([url, score]) => ({ url, score }));
  ranked.sort((a, b) => b.score - a.score || a.url.localeCompare(b.url));
  const indexable = ranked.filter(({ url }) => pageEligibility(site, url).eligible);
  return {
    pages: ranked.length,
    top: ranked.slice(0, size),
    lowestIndexable: indexable.slice(-size).reverse(),
  };
}
