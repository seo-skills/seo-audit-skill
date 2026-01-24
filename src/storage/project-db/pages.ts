import type Database from 'better-sqlite3';
import type {
  DbPage,
  HydratedPage,
  HydratedPageWithHtml,
  PageQueryOptions,
  InsertPageInput,
  PageCoreWebVitals,
} from '../types.js';
import { hashUrl } from '../utils/hash.js';
import { compressHtml, decompressHtml } from '../utils/compression.js';

/**
 * Hydrate a page record (without HTML)
 */
function hydratePage(row: DbPage): HydratedPage {
  const cwv: PageCoreWebVitals = {};
  if (row.cwv_lcp != null) cwv.lcp = row.cwv_lcp;
  if (row.cwv_cls != null) cwv.cls = row.cwv_cls;
  if (row.cwv_inp != null) cwv.inp = row.cwv_inp;
  if (row.cwv_fcp != null) cwv.fcp = row.cwv_fcp;
  if (row.cwv_ttfb != null) cwv.ttfb = row.cwv_ttfb;

  return {
    id: row.id,
    crawlId: row.crawl_id,
    url: row.url,
    urlHash: row.url_hash,
    statusCode: row.status_code,
    depth: row.depth,
    contentType: row.content_type,
    htmlSize: row.html_size,
    headers: row.headers_json ? JSON.parse(row.headers_json) : {},
    loadTimeMs: row.load_time_ms,
    ttfbMs: row.ttfb_ms,
    cwv,
    errorMessage: row.error_message,
    crawledAt: new Date(row.crawled_at),
  };
}

/**
 * Hydrate a page with HTML content
 */
function hydratePageWithHtml(row: DbPage): HydratedPageWithHtml {
  const base = hydratePage(row);
  const html = row.html
    ? decompressHtml(row.html, row.html_compressed === 1)
    : '';

  return { ...base, html };
}

/**
 * Insert a page into the database
 *
 * HTML is automatically compressed if larger than 10KB
 *
 * @param db - Database instance
 * @param crawlId - Database crawl ID (not crawl_id string)
 * @param input - Page data to insert
 * @returns Inserted page (without HTML)
 */
export function insertPage(
  db: Database.Database,
  crawlId: number,
  input: InsertPageInput
): HydratedPage {
  const urlHash = hashUrl(input.url);

  // Compress HTML if provided
  let htmlData: Buffer | null = null;
  let htmlCompressed = 0;
  let htmlSize: number | null = null;

  if (input.html) {
    const compressed = compressHtml(input.html);
    htmlData = compressed.data;
    htmlCompressed = compressed.compressed ? 1 : 0;
    htmlSize = compressed.originalSize;
  }

  const result = db
    .prepare(
      `
    INSERT INTO pages (
      crawl_id, url, url_hash, status_code, depth, content_type,
      html, html_compressed, html_size, headers_json,
      load_time_ms, ttfb_ms,
      cwv_lcp, cwv_cls, cwv_inp, cwv_fcp, cwv_ttfb,
      error_message
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    RETURNING *
  `
    )
    .get(
      crawlId,
      input.url,
      urlHash,
      input.statusCode,
      input.depth,
      input.contentType ?? null,
      htmlData,
      htmlCompressed,
      htmlSize,
      input.headers ? JSON.stringify(input.headers) : null,
      input.loadTimeMs ?? null,
      input.ttfbMs ?? null,
      input.cwv?.lcp ?? null,
      input.cwv?.cls ?? null,
      input.cwv?.inp ?? null,
      input.cwv?.fcp ?? null,
      input.cwv?.ttfb ?? null,
      input.errorMessage ?? null
    ) as DbPage;

  return hydratePage(result);
}

/**
 * Insert multiple pages in a transaction
 *
 * @param db - Database instance
 * @param crawlId - Database crawl ID
 * @param pages - Array of page inputs
 * @returns Number of pages inserted
 */
export function insertPages(
  db: Database.Database,
  crawlId: number,
  pages: InsertPageInput[]
): number {
  const stmt = db.prepare(`
    INSERT INTO pages (
      crawl_id, url, url_hash, status_code, depth, content_type,
      html, html_compressed, html_size, headers_json,
      load_time_ms, ttfb_ms,
      cwv_lcp, cwv_cls, cwv_inp, cwv_fcp, cwv_ttfb,
      error_message
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertAll = db.transaction((inputs: InsertPageInput[]) => {
    let count = 0;
    for (const input of inputs) {
      const urlHash = hashUrl(input.url);

      let htmlData: Buffer | null = null;
      let htmlCompressed = 0;
      let htmlSize: number | null = null;

      if (input.html) {
        const compressed = compressHtml(input.html);
        htmlData = compressed.data;
        htmlCompressed = compressed.compressed ? 1 : 0;
        htmlSize = compressed.originalSize;
      }

      stmt.run(
        crawlId,
        input.url,
        urlHash,
        input.statusCode,
        input.depth,
        input.contentType ?? null,
        htmlData,
        htmlCompressed,
        htmlSize,
        input.headers ? JSON.stringify(input.headers) : null,
        input.loadTimeMs ?? null,
        input.ttfbMs ?? null,
        input.cwv?.lcp ?? null,
        input.cwv?.cls ?? null,
        input.cwv?.inp ?? null,
        input.cwv?.fcp ?? null,
        input.cwv?.ttfb ?? null,
        input.errorMessage ?? null
      );
      count++;
    }
    return count;
  });

  return insertAll(pages);
}

/**
 * Get a page by ID (without HTML)
 *
 * @param db - Database instance
 * @param pageId - Page ID
 * @returns Page record or null
 */
export function getPage(
  db: Database.Database,
  pageId: number
): HydratedPage | null {
  const row = db
    .prepare(
      `
    SELECT id, crawl_id, url, url_hash, status_code, depth, content_type,
           html_compressed, html_size, headers_json, load_time_ms, ttfb_ms,
           cwv_lcp, cwv_cls, cwv_inp, cwv_fcp, cwv_ttfb,
           error_message, crawled_at
    FROM pages WHERE id = ?
  `
    )
    .get(pageId) as (Omit<DbPage, 'html'> & { html: null }) | undefined;

  if (!row) return null;
  return hydratePage({ ...row, html: null });
}

/**
 * Get a page by URL hash
 *
 * @param db - Database instance
 * @param crawlId - Database crawl ID
 * @param urlHash - URL hash
 * @returns Page record or null
 */
export function getPageByHash(
  db: Database.Database,
  crawlId: number,
  urlHash: string
): HydratedPage | null {
  const row = db
    .prepare(
      `
    SELECT id, crawl_id, url, url_hash, status_code, depth, content_type,
           html_compressed, html_size, headers_json, load_time_ms, ttfb_ms,
           cwv_lcp, cwv_cls, cwv_inp, cwv_fcp, cwv_ttfb,
           error_message, crawled_at
    FROM pages WHERE crawl_id = ? AND url_hash = ?
  `
    )
    .get(crawlId, urlHash) as (Omit<DbPage, 'html'> & { html: null }) | undefined;

  if (!row) return null;
  return hydratePage({ ...row, html: null });
}

/**
 * Get page HTML content
 *
 * @param db - Database instance
 * @param pageId - Page ID
 * @returns HTML string or null
 */
export function getPageHtml(
  db: Database.Database,
  pageId: number
): string | null {
  const row = db
    .prepare('SELECT html, html_compressed FROM pages WHERE id = ?')
    .get(pageId) as { html: Buffer | null; html_compressed: number } | undefined;

  if (!row || !row.html) return null;
  return decompressHtml(row.html, row.html_compressed === 1);
}

/**
 * Get a page with HTML content
 *
 * @param db - Database instance
 * @param pageId - Page ID
 * @returns Page with HTML or null
 */
export function getPageWithHtml(
  db: Database.Database,
  pageId: number
): HydratedPageWithHtml | null {
  const row = db
    .prepare('SELECT * FROM pages WHERE id = ?')
    .get(pageId) as DbPage | undefined;

  if (!row) return null;
  return hydratePageWithHtml(row);
}

/**
 * List pages for a crawl
 *
 * @param db - Database instance
 * @param crawlId - Database crawl ID
 * @param options - Query options
 * @returns Array of pages (without HTML)
 */
export function listPages(
  db: Database.Database,
  crawlId: number,
  options: PageQueryOptions = {}
): HydratedPage[] {
  const conditions: string[] = ['crawl_id = ?'];
  const params: unknown[] = [crawlId];

  if (options.statusCode !== undefined) {
    conditions.push('status_code = ?');
    params.push(options.statusCode);
  }

  if (options.minStatusCode !== undefined) {
    conditions.push('status_code >= ?');
    params.push(options.minStatusCode);
  }

  if (options.maxStatusCode !== undefined) {
    conditions.push('status_code <= ?');
    params.push(options.maxStatusCode);
  }

  if (options.hasError !== undefined) {
    conditions.push(options.hasError ? 'error_message IS NOT NULL' : 'error_message IS NULL');
  }

  const limit = options.limit ?? 1000;
  const offset = options.offset ?? 0;

  const rows = db
    .prepare(
      `
    SELECT id, crawl_id, url, url_hash, status_code, depth, content_type,
           html_compressed, html_size, headers_json, load_time_ms, ttfb_ms,
           cwv_lcp, cwv_cls, cwv_inp, cwv_fcp, cwv_ttfb,
           error_message, crawled_at
    FROM pages
    WHERE ${conditions.join(' AND ')}
    ORDER BY id
    LIMIT ? OFFSET ?
  `
    )
    .all(...params, limit, offset) as Array<Omit<DbPage, 'html'> & { html: null }>;

  return rows.map((row) => hydratePage({ ...row, html: null }));
}

/**
 * Get pages by status code range (e.g., 4xx errors)
 *
 * @param db - Database instance
 * @param crawlId - Database crawl ID
 * @param minStatus - Minimum status code
 * @param maxStatus - Maximum status code
 * @returns Array of pages
 */
export function getPagesByStatusRange(
  db: Database.Database,
  crawlId: number,
  minStatus: number,
  maxStatus: number
): HydratedPage[] {
  return listPages(db, crawlId, {
    minStatusCode: minStatus,
    maxStatusCode: maxStatus,
  });
}

/**
 * Get pages with errors
 *
 * @param db - Database instance
 * @param crawlId - Database crawl ID
 * @returns Array of pages with errors
 */
export function getErrorPages(
  db: Database.Database,
  crawlId: number
): HydratedPage[] {
  return listPages(db, crawlId, { hasError: true });
}

/**
 * Get page count for a crawl
 *
 * @param db - Database instance
 * @param crawlId - Database crawl ID
 * @returns Number of pages
 */
export function getPageCount(db: Database.Database, crawlId: number): number {
  const result = db
    .prepare('SELECT COUNT(*) as count FROM pages WHERE crawl_id = ?')
    .get(crawlId) as { count: number };
  return result.count;
}

/**
 * Get total HTML storage size for a crawl
 *
 * @param db - Database instance
 * @param crawlId - Database crawl ID
 * @returns Object with original and stored sizes
 */
export function getHtmlStorageStats(
  db: Database.Database,
  crawlId: number
): { originalBytes: number; storedBytes: number; compressionRatio: number } {
  const result = db
    .prepare(
      `
    SELECT
      COALESCE(SUM(html_size), 0) as original_bytes,
      COALESCE(SUM(LENGTH(html)), 0) as stored_bytes
    FROM pages
    WHERE crawl_id = ?
  `
    )
    .get(crawlId) as { original_bytes: number; stored_bytes: number };

  const original = result.original_bytes;
  const stored = result.stored_bytes;
  const ratio = original > 0 ? Math.round((1 - stored / original) * 100) : 0;

  return {
    originalBytes: original,
    storedBytes: stored,
    compressionRatio: ratio,
  };
}
