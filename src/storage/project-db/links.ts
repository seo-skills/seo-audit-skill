import type Database from 'better-sqlite3';
import type { DbLink, HydratedLink, InsertLinkInput } from '../types.js';
import { hashUrl } from '../utils/hash.js';

/**
 * Hydrate a link record
 */
function hydrateLink(row: DbLink): HydratedLink {
  return {
    id: row.id,
    pageId: row.page_id,
    href: row.href,
    hrefHash: row.href_hash,
    anchorText: row.anchor_text,
    isInternal: row.is_internal === 1,
    isNofollow: row.is_nofollow === 1,
    relValue: row.rel_value,
    targetStatusCode: row.target_status_code,
    targetError: row.target_error,
  };
}

/**
 * Insert a single link
 *
 * @param db - Database instance
 * @param pageId - Page ID
 * @param input - Link data
 * @returns Inserted link
 */
export function insertLink(
  db: Database.Database,
  pageId: number,
  input: InsertLinkInput
): HydratedLink {
  const hrefHash = hashUrl(input.href);

  const result = db
    .prepare(
      `
    INSERT INTO links (
      page_id, href, href_hash, anchor_text,
      is_internal, is_nofollow, rel_value,
      target_status_code, target_error
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    RETURNING *
  `
    )
    .get(
      pageId,
      input.href,
      hrefHash,
      input.anchorText ?? null,
      input.isInternal ? 1 : 0,
      input.isNofollow ? 1 : 0,
      input.relValue ?? null,
      input.targetStatusCode ?? null,
      input.targetError ?? null
    ) as DbLink;

  return hydrateLink(result);
}

/**
 * Insert multiple links in a transaction
 *
 * @param db - Database instance
 * @param pageId - Page ID
 * @param links - Array of link inputs
 * @returns Number of links inserted
 */
export function insertLinks(
  db: Database.Database,
  pageId: number,
  links: InsertLinkInput[]
): number {
  if (links.length === 0) return 0;

  const stmt = db.prepare(`
    INSERT INTO links (
      page_id, href, href_hash, anchor_text,
      is_internal, is_nofollow, rel_value,
      target_status_code, target_error
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertAll = db.transaction((inputs: InsertLinkInput[]) => {
    let count = 0;
    for (const input of inputs) {
      const hrefHash = hashUrl(input.href);
      stmt.run(
        pageId,
        input.href,
        hrefHash,
        input.anchorText ?? null,
        input.isInternal ? 1 : 0,
        input.isNofollow ? 1 : 0,
        input.relValue ?? null,
        input.targetStatusCode ?? null,
        input.targetError ?? null
      );
      count++;
    }
    return count;
  });

  return insertAll(links);
}

/**
 * Get links for a page
 *
 * @param db - Database instance
 * @param pageId - Page ID
 * @returns Array of links
 */
export function getLinksByPage(
  db: Database.Database,
  pageId: number
): HydratedLink[] {
  const rows = db
    .prepare('SELECT * FROM links WHERE page_id = ?')
    .all(pageId) as DbLink[];

  return rows.map(hydrateLink);
}

/**
 * Get internal links for a page
 *
 * @param db - Database instance
 * @param pageId - Page ID
 * @returns Array of internal links
 */
export function getInternalLinks(
  db: Database.Database,
  pageId: number
): HydratedLink[] {
  const rows = db
    .prepare('SELECT * FROM links WHERE page_id = ? AND is_internal = 1')
    .all(pageId) as DbLink[];

  return rows.map(hydrateLink);
}

/**
 * Get external links for a page
 *
 * @param db - Database instance
 * @param pageId - Page ID
 * @returns Array of external links
 */
export function getExternalLinks(
  db: Database.Database,
  pageId: number
): HydratedLink[] {
  const rows = db
    .prepare('SELECT * FROM links WHERE page_id = ? AND is_internal = 0')
    .all(pageId) as DbLink[];

  return rows.map(hydrateLink);
}

/**
 * Get broken links for a crawl (links with error status codes or errors)
 *
 * @param db - Database instance
 * @param crawlId - Database crawl ID
 * @returns Array of broken links with their source page URLs
 */
export function getBrokenLinks(
  db: Database.Database,
  crawlId: number
): Array<HydratedLink & { sourceUrl: string }> {
  const rows = db
    .prepare(
      `
    SELECT l.*, p.url as source_url
    FROM links l
    JOIN pages p ON l.page_id = p.id
    WHERE p.crawl_id = ?
      AND (l.target_status_code >= 400 OR l.target_error IS NOT NULL)
  `
    )
    .all(crawlId) as Array<DbLink & { source_url: string }>;

  return rows.map((row) => ({
    ...hydrateLink(row),
    sourceUrl: row.source_url,
  }));
}

/**
 * Get all unique external links for a crawl
 *
 * @param db - Database instance
 * @param crawlId - Database crawl ID
 * @returns Array of unique external link URLs
 */
export function getUniqueExternalLinks(
  db: Database.Database,
  crawlId: number
): string[] {
  const rows = db
    .prepare(
      `
    SELECT DISTINCT l.href
    FROM links l
    JOIN pages p ON l.page_id = p.id
    WHERE p.crawl_id = ? AND l.is_internal = 0
  `
    )
    .all(crawlId) as Array<{ href: string }>;

  return rows.map((r) => r.href);
}

/**
 * Update link target status after checking
 *
 * @param db - Database instance
 * @param linkId - Link ID
 * @param statusCode - Target status code
 * @param error - Optional error message
 */
export function updateLinkStatus(
  db: Database.Database,
  linkId: number,
  statusCode: number,
  error?: string
): void {
  db.prepare(
    `
    UPDATE links
    SET target_status_code = ?, target_error = ?
    WHERE id = ?
  `
  ).run(statusCode, error ?? null, linkId);
}

/**
 * Bulk update link statuses
 *
 * @param db - Database instance
 * @param updates - Array of updates
 */
export function updateLinkStatuses(
  db: Database.Database,
  updates: Array<{ linkId: number; statusCode: number; error?: string }>
): void {
  const stmt = db.prepare(`
    UPDATE links
    SET target_status_code = ?, target_error = ?
    WHERE id = ?
  `);

  const updateAll = db.transaction(
    (items: typeof updates) => {
      for (const item of items) {
        stmt.run(item.statusCode, item.error ?? null, item.linkId);
      }
    }
  );

  updateAll(updates);
}

/**
 * Get link count for a page
 */
export function getLinkCount(db: Database.Database, pageId: number): number {
  const result = db
    .prepare('SELECT COUNT(*) as count FROM links WHERE page_id = ?')
    .get(pageId) as { count: number };
  return result.count;
}

/**
 * Get link statistics for a crawl
 */
export function getLinkStats(
  db: Database.Database,
  crawlId: number
): {
  total: number;
  internal: number;
  external: number;
  broken: number;
  nofollow: number;
} {
  const result = db
    .prepare(
      `
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN l.is_internal = 1 THEN 1 ELSE 0 END) as internal,
      SUM(CASE WHEN l.is_internal = 0 THEN 1 ELSE 0 END) as external,
      SUM(CASE WHEN l.target_status_code >= 400 OR l.target_error IS NOT NULL THEN 1 ELSE 0 END) as broken,
      SUM(CASE WHEN l.is_nofollow = 1 THEN 1 ELSE 0 END) as nofollow
    FROM links l
    JOIN pages p ON l.page_id = p.id
    WHERE p.crawl_id = ?
  `
    )
    .get(crawlId) as {
    total: number;
    internal: number;
    external: number;
    broken: number;
    nofollow: number;
  };

  return result;
}
