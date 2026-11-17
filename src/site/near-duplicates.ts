/**
 * Near-duplicate pages across a crawl, in roughly linear time.
 *
 * Each page's main content becomes a set of hashed word trigrams. Comparing
 * every pair is quadratic: 50 million set intersections at 10,000 pages. So:
 *
 * 1. Pages with identical trigram sets are merged into one representative.
 * 2. Each set gets a MinHash signature (128 values). Locality-sensitive
 *    hashing (32 bands of 4) buckets signatures so that similar pages share a
 *    bucket; only pages sharing one become a candidate pair.
 * 3. A candidate whose signatures agree on fewer than 40% of positions is
 *    dropped: its similarity is far below either threshold.
 * 4. Every remaining candidate is confirmed with the exact Jaccard similarity
 *    of the two sorted trigram arrays. No verdict rests on an estimate.
 *
 * A template-heavy site can still put most pages in one bucket. Past
 * {@link MAX_CANDIDATE_PAIRS} candidates the analysis stops and reports that
 * it could not compare, rather than run without bound.
 */

/** Words read from the start of the main content */
const MAX_WORDS = 500;
/** Signature length, as bands × rows */
const BANDS = 32;
const ROWS = 4;
const SIGNATURE_SIZE = BANDS * ROWS;
/** Candidates below this estimated similarity are not worth confirming */
const ESTIMATE_FLOOR = 0.4;
/** Past this, the analysis reports it could not compare */
export const MAX_CANDIDATE_PAIRS = 5_000_000;

/** FNV-1a, 32 bits: stable across runs and machines */
function fnv1a(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** A 32-bit integer mix (from MurmurHash3's finaliser), seeded per function */
function mix(value: number, seed: number): number {
  let h = (value ^ seed) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

/** Fixed seeds, so signatures are reproducible */
const SEEDS = Array.from({ length: SIGNATURE_SIZE }, (_, i) => fnv1a(`seomator-minhash-${i}`));

/**
 * The sorted, de-duplicated trigram hashes of a text's first 500 words.
 *
 * Words are runs of Unicode letters and digits, so a page in Turkish, Greek
 * or Japanese is not read as empty, which is what an ASCII-only tokenizer did.
 */
export function shingleText(text: string): Uint32Array {
  const words = (text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).slice(0, MAX_WORDS);
  const hashes = new Set<number>();
  for (let i = 0; i + 2 < words.length; i++) {
    hashes.add(fnv1a(`${words[i]} ${words[i + 1]} ${words[i + 2]}`));
  }
  return Uint32Array.from(hashes).sort();
}

/** MinHash signature of a shingle set */
export function minhashSignature(shingles: Uint32Array): Uint32Array {
  const signature = new Uint32Array(SIGNATURE_SIZE).fill(0xffffffff);
  for (const shingle of shingles) {
    for (let i = 0; i < SIGNATURE_SIZE; i++) {
      const value = mix(shingle, SEEDS[i]);
      if (value < signature[i]) signature[i] = value;
    }
  }
  return signature;
}

/** Exact Jaccard similarity of two sorted arrays, by merging */
export function jaccardSorted(a: Uint32Array, b: Uint32Array): number {
  if (a.length === 0 && b.length === 0) return 1;
  let i = 0;
  let j = 0;
  let shared = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      shared++;
      i++;
      j++;
    } else if (a[i] < b[j]) {
      i++;
    } else {
      j++;
    }
  }
  const union = a.length + b.length - shared;
  return union === 0 ? 0 : shared / union;
}

function estimate(a: Uint32Array, b: Uint32Array): number {
  let same = 0;
  for (let i = 0; i < SIGNATURE_SIZE; i++) if (a[i] === b[i]) same++;
  return same / SIGNATURE_SIZE;
}

function sameArray(a: Uint32Array, b: Uint32Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/** One page entering the comparison */
export interface ShingledPage {
  url: string;
  shingles: Uint32Array;
}

/** A page's similar pages, most similar first */
export interface SimilarPage {
  url: string;
  similarity: number;
}

export type NearDuplicateAnalysis =
  | { kind: 'compared'; similar: Map<string, SimilarPage[]>; candidatePairs: number }
  | { kind: 'too-many-candidates'; candidatePairs: number };

/**
 * Every pair of pages at or above `minSimilarity`, per page.
 *
 * The result does not depend on the order pages are given in: pages are
 * sorted by URL first, and every confirmed pair is recorded on both pages.
 */
export function findNearDuplicates(
  input: ShingledPage[],
  minSimilarity: number,
  maxCandidatePairs = MAX_CANDIDATE_PAIRS
): NearDuplicateAnalysis {
  const pages = [...input].sort((a, b) => (a.url < b.url ? -1 : a.url > b.url ? 1 : 0));
  const similar = new Map<string, SimilarPage[]>();
  const add = (a: string, b: string, similarity: number) => {
    let list = similar.get(a);
    if (!list) similar.set(a, (list = []));
    list.push({ url: b, similarity });
  };

  // 1. Identical shingle sets: one representative each, members paired at 1.0
  const representatives: Array<{ page: ShingledPage; members: string[] }> = [];
  const byExact = new Map<string, Array<{ page: ShingledPage; members: string[] }>>();
  for (const page of pages) {
    if (page.shingles.length === 0) continue;
    const key = `${page.shingles.length}:${page.shingles[0]}:${page.shingles[page.shingles.length - 1]}`;
    const bucket = byExact.get(key) ?? [];
    const existing = bucket.find((r) => sameArray(r.page.shingles, page.shingles));
    if (existing) {
      for (const member of existing.members) {
        add(member, page.url, 1);
        add(page.url, member, 1);
      }
      existing.members.push(page.url);
    } else {
      const representative = { page, members: [page.url] };
      bucket.push(representative);
      byExact.set(key, bucket);
      representatives.push(representative);
    }
  }

  // 2. Signatures and LSH buckets over the representatives
  const signatures = representatives.map((r) => minhashSignature(r.page.shingles));
  const buckets = new Map<string, number[]>();
  for (let index = 0; index < representatives.length; index++) {
    const signature = signatures[index];
    for (let band = 0; band < BANDS; band++) {
      const offset = band * ROWS;
      const key = `${band}:${signature[offset]}:${signature[offset + 1]}:${signature[offset + 2]}:${signature[offset + 3]}`;
      const bucket = buckets.get(key);
      if (bucket) bucket.push(index);
      else buckets.set(key, [index]);
    }
  }

  // 3. Candidate pairs, once each across bands
  const seen = new Set<number>();
  const n = representatives.length;
  let candidatePairs = 0;
  for (const bucket of buckets.values()) {
    if (bucket.length < 2) continue;
    for (let x = 0; x < bucket.length; x++) {
      for (let y = x + 1; y < bucket.length; y++) {
        const a = bucket[x];
        const b = bucket[y];
        const id = a < b ? a * n + b : b * n + a;
        if (seen.has(id)) continue;
        seen.add(id);
        candidatePairs++;
        if (candidatePairs > maxCandidatePairs) {
          return { kind: 'too-many-candidates', candidatePairs };
        }
      }
    }
  }

  // 4. Confirm each candidate exactly
  for (const id of seen) {
    const a = Math.floor(id / n);
    const b = id % n;
    if (estimate(signatures[a], signatures[b]) < ESTIMATE_FLOOR) continue;
    const similarity = jaccardSorted(representatives[a].page.shingles, representatives[b].page.shingles);
    if (similarity < minSimilarity) continue;
    for (const left of representatives[a].members) {
      for (const right of representatives[b].members) {
        add(left, right, similarity);
        add(right, left, similarity);
      }
    }
  }

  for (const list of similar.values()) {
    list.sort((p, q) => q.similarity - p.similarity || (p.url < q.url ? -1 : p.url > q.url ? 1 : 0));
  }
  return { kind: 'compared', similar, candidatePairs };
}
