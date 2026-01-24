import type Database from 'better-sqlite3';
import type { DbImage, HydratedImage, InsertImageInput } from '../types.js';
import { hashUrl } from '../utils/hash.js';

/**
 * Hydrate an image record
 */
function hydrateImage(row: DbImage): HydratedImage {
  return {
    id: row.id,
    pageId: row.page_id,
    src: row.src,
    srcHash: row.src_hash,
    alt: row.alt,
    hasAlt: row.has_alt === 1,
    width: row.width,
    height: row.height,
    isLazyLoaded: row.is_lazy_loaded === 1,
    loadingAttr: row.loading_attr,
    srcset: row.srcset,
    fileSize: row.file_size,
    format: row.format,
  };
}

/**
 * Insert a single image
 *
 * @param db - Database instance
 * @param pageId - Page ID
 * @param input - Image data
 * @returns Inserted image
 */
export function insertImage(
  db: Database.Database,
  pageId: number,
  input: InsertImageInput
): HydratedImage {
  const srcHash = hashUrl(input.src);

  const result = db
    .prepare(
      `
    INSERT INTO images (
      page_id, src, src_hash, alt, has_alt,
      width, height, is_lazy_loaded, loading_attr,
      srcset, file_size, format
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    RETURNING *
  `
    )
    .get(
      pageId,
      input.src,
      srcHash,
      input.alt ?? null,
      input.hasAlt ? 1 : 0,
      input.width ?? null,
      input.height ?? null,
      input.isLazyLoaded ? 1 : 0,
      input.loadingAttr ?? null,
      input.srcset ?? null,
      input.fileSize ?? null,
      input.format ?? null
    ) as DbImage;

  return hydrateImage(result);
}

/**
 * Insert multiple images in a transaction
 *
 * @param db - Database instance
 * @param pageId - Page ID
 * @param images - Array of image inputs
 * @returns Number of images inserted
 */
export function insertImages(
  db: Database.Database,
  pageId: number,
  images: InsertImageInput[]
): number {
  if (images.length === 0) return 0;

  const stmt = db.prepare(`
    INSERT INTO images (
      page_id, src, src_hash, alt, has_alt,
      width, height, is_lazy_loaded, loading_attr,
      srcset, file_size, format
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertAll = db.transaction((inputs: InsertImageInput[]) => {
    let count = 0;
    for (const input of inputs) {
      const srcHash = hashUrl(input.src);
      stmt.run(
        pageId,
        input.src,
        srcHash,
        input.alt ?? null,
        input.hasAlt ? 1 : 0,
        input.width ?? null,
        input.height ?? null,
        input.isLazyLoaded ? 1 : 0,
        input.loadingAttr ?? null,
        input.srcset ?? null,
        input.fileSize ?? null,
        input.format ?? null
      );
      count++;
    }
    return count;
  });

  return insertAll(images);
}

/**
 * Get images for a page
 *
 * @param db - Database instance
 * @param pageId - Page ID
 * @returns Array of images
 */
export function getImagesByPage(
  db: Database.Database,
  pageId: number
): HydratedImage[] {
  const rows = db
    .prepare('SELECT * FROM images WHERE page_id = ?')
    .all(pageId) as DbImage[];

  return rows.map(hydrateImage);
}

/**
 * Get images missing alt text for a crawl
 *
 * @param db - Database instance
 * @param crawlId - Database crawl ID
 * @returns Array of images without alt text and their source URLs
 */
export function getImagesWithoutAlt(
  db: Database.Database,
  crawlId: number
): Array<HydratedImage & { sourceUrl: string }> {
  const rows = db
    .prepare(
      `
    SELECT i.*, p.url as source_url
    FROM images i
    JOIN pages p ON i.page_id = p.id
    WHERE p.crawl_id = ? AND i.has_alt = 0
  `
    )
    .all(crawlId) as Array<DbImage & { source_url: string }>;

  return rows.map((row) => ({
    ...hydrateImage(row),
    sourceUrl: row.source_url,
  }));
}

/**
 * Get images without dimensions for a crawl
 *
 * @param db - Database instance
 * @param crawlId - Database crawl ID
 * @returns Array of images without width/height
 */
export function getImagesWithoutDimensions(
  db: Database.Database,
  crawlId: number
): Array<HydratedImage & { sourceUrl: string }> {
  const rows = db
    .prepare(
      `
    SELECT i.*, p.url as source_url
    FROM images i
    JOIN pages p ON i.page_id = p.id
    WHERE p.crawl_id = ? AND (i.width IS NULL OR i.height IS NULL)
  `
    )
    .all(crawlId) as Array<DbImage & { source_url: string }>;

  return rows.map((row) => ({
    ...hydrateImage(row),
    sourceUrl: row.source_url,
  }));
}

/**
 * Get images not using lazy loading for a crawl
 *
 * @param db - Database instance
 * @param crawlId - Database crawl ID
 * @returns Array of non-lazy-loaded images
 */
export function getNonLazyImages(
  db: Database.Database,
  crawlId: number
): Array<HydratedImage & { sourceUrl: string }> {
  const rows = db
    .prepare(
      `
    SELECT i.*, p.url as source_url
    FROM images i
    JOIN pages p ON i.page_id = p.id
    WHERE p.crawl_id = ? AND i.is_lazy_loaded = 0
  `
    )
    .all(crawlId) as Array<DbImage & { source_url: string }>;

  return rows.map((row) => ({
    ...hydrateImage(row),
    sourceUrl: row.source_url,
  }));
}

/**
 * Get images by format for a crawl
 *
 * @param db - Database instance
 * @param crawlId - Database crawl ID
 * @param format - Image format (e.g., 'jpg', 'png', 'webp')
 * @returns Array of images with that format
 */
export function getImagesByFormat(
  db: Database.Database,
  crawlId: number,
  format: string
): HydratedImage[] {
  const rows = db
    .prepare(
      `
    SELECT i.*
    FROM images i
    JOIN pages p ON i.page_id = p.id
    WHERE p.crawl_id = ? AND LOWER(i.format) = LOWER(?)
  `
    )
    .all(crawlId, format) as DbImage[];

  return rows.map(hydrateImage);
}

/**
 * Get image count for a page
 */
export function getImageCount(db: Database.Database, pageId: number): number {
  const result = db
    .prepare('SELECT COUNT(*) as count FROM images WHERE page_id = ?')
    .get(pageId) as { count: number };
  return result.count;
}

/**
 * Get image statistics for a crawl
 */
export function getImageStats(
  db: Database.Database,
  crawlId: number
): {
  total: number;
  withAlt: number;
  withoutAlt: number;
  withDimensions: number;
  lazyLoaded: number;
  totalFileSize: number;
} {
  const result = db
    .prepare(
      `
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN i.has_alt = 1 THEN 1 ELSE 0 END) as with_alt,
      SUM(CASE WHEN i.has_alt = 0 THEN 1 ELSE 0 END) as without_alt,
      SUM(CASE WHEN i.width IS NOT NULL AND i.height IS NOT NULL THEN 1 ELSE 0 END) as with_dimensions,
      SUM(CASE WHEN i.is_lazy_loaded = 1 THEN 1 ELSE 0 END) as lazy_loaded,
      COALESCE(SUM(i.file_size), 0) as total_file_size
    FROM images i
    JOIN pages p ON i.page_id = p.id
    WHERE p.crawl_id = ?
  `
    )
    .get(crawlId) as {
    total: number;
    with_alt: number;
    without_alt: number;
    with_dimensions: number;
    lazy_loaded: number;
    total_file_size: number;
  };

  return {
    total: result.total,
    withAlt: result.with_alt,
    withoutAlt: result.without_alt,
    withDimensions: result.with_dimensions,
    lazyLoaded: result.lazy_loaded,
    totalFileSize: result.total_file_size,
  };
}

/**
 * Get image format distribution for a crawl
 */
export function getImageFormatDistribution(
  db: Database.Database,
  crawlId: number
): Array<{ format: string; count: number }> {
  const rows = db
    .prepare(
      `
    SELECT LOWER(COALESCE(i.format, 'unknown')) as format, COUNT(*) as count
    FROM images i
    JOIN pages p ON i.page_id = p.id
    WHERE p.crawl_id = ?
    GROUP BY LOWER(COALESCE(i.format, 'unknown'))
    ORDER BY count DESC
  `
    )
    .all(crawlId) as Array<{ format: string; count: number }>;

  return rows;
}
