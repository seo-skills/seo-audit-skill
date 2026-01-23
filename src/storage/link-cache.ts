import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import { getLinkCachePath } from './paths.js';

/**
 * Cached link check result
 */
export interface CachedLinkResult {
  /** URL that was checked */
  url: string;
  /** HTTP status code (0 if error) */
  statusCode: number;
  /** Error message if check failed */
  error?: string;
  /** When the check was performed (ISO string) */
  checkedAt: string;
  /** Whether the result is still valid based on TTL */
  isValid: boolean;
}

/**
 * Options for the LinkCache
 */
export interface LinkCacheOptions {
  /** Cache time-to-live in days (default: 7) */
  ttlDays: number;
  /** Custom database path (for testing) */
  dbPath?: string;
}

/**
 * SQLite-based cache for external link check results
 */
export class LinkCache {
  private db: Database.Database;
  private ttlMs: number;

  constructor(options: Partial<LinkCacheOptions> = {}) {
    const ttlDays = options.ttlDays ?? 7;
    this.ttlMs = ttlDays * 24 * 60 * 60 * 1000;

    // Ensure global directory exists
    const dbPath = options.dbPath ?? getLinkCachePath();
    const dir = path.dirname(dbPath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Open database
    this.db = new Database(dbPath);

    // Enable WAL mode for better concurrent performance
    this.db.pragma('journal_mode = WAL');

    // Create table if not exists
    this.db.prepare(`
      CREATE TABLE IF NOT EXISTS link_cache (
        url TEXT PRIMARY KEY,
        status_code INTEGER NOT NULL,
        error TEXT,
        checked_at TEXT NOT NULL
      )
    `).run();

    // Create index on checked_at for cleanup
    this.db.prepare(`
      CREATE INDEX IF NOT EXISTS idx_checked_at ON link_cache(checked_at)
    `).run();
  }

  /**
   * Get cached result for a URL
   * @param url - URL to look up
   * @returns Cached result or null if not found or expired
   */
  get(url: string): CachedLinkResult | null {
    const stmt = this.db.prepare(`
      SELECT url, status_code, error, checked_at
      FROM link_cache
      WHERE url = ?
    `);

    const row = stmt.get(url) as {
      url: string;
      status_code: number;
      error: string | null;
      checked_at: string;
    } | undefined;

    if (!row) {
      return null;
    }

    const checkedAt = new Date(row.checked_at).getTime();
    const now = Date.now();
    const isValid = (now - checkedAt) < this.ttlMs;

    return {
      url: row.url,
      statusCode: row.status_code,
      error: row.error ?? undefined,
      checkedAt: row.checked_at,
      isValid,
    };
  }

  /**
   * Get cached results for multiple URLs
   * @param urls - URLs to look up
   * @returns Map of URL to cached result (only includes found results)
   */
  getMany(urls: string[]): Map<string, CachedLinkResult> {
    if (urls.length === 0) {
      return new Map();
    }

    // Use a single query with IN clause for efficiency
    const placeholders = urls.map(() => '?').join(',');
    const stmt = this.db.prepare(`
      SELECT url, status_code, error, checked_at
      FROM link_cache
      WHERE url IN (${placeholders})
    `);

    const rows = stmt.all(...urls) as Array<{
      url: string;
      status_code: number;
      error: string | null;
      checked_at: string;
    }>;

    const now = Date.now();
    const results = new Map<string, CachedLinkResult>();

    for (const row of rows) {
      const checkedAt = new Date(row.checked_at).getTime();
      const isValid = (now - checkedAt) < this.ttlMs;

      results.set(row.url, {
        url: row.url,
        statusCode: row.status_code,
        error: row.error ?? undefined,
        checkedAt: row.checked_at,
        isValid,
      });
    }

    return results;
  }

  /**
   * Store a link check result
   * @param url - URL that was checked
   * @param statusCode - HTTP status code (0 for errors)
   * @param error - Error message if check failed
   */
  set(url: string, statusCode: number, error?: string): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO link_cache (url, status_code, error, checked_at)
      VALUES (?, ?, ?, ?)
    `);

    stmt.run(url, statusCode, error ?? null, new Date().toISOString());
  }

  /**
   * Store multiple link check results
   * @param results - Array of results to store
   */
  setMany(results: Array<{ url: string; statusCode: number; error?: string }>): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO link_cache (url, status_code, error, checked_at)
      VALUES (?, ?, ?, ?)
    `);

    const now = new Date().toISOString();
    const insertMany = this.db.transaction((items: typeof results) => {
      for (const item of items) {
        stmt.run(item.url, item.statusCode, item.error ?? null, now);
      }
    });

    insertMany(results);
  }

  /**
   * Remove expired entries from the cache
   * @returns Number of entries removed
   */
  cleanup(): number {
    const cutoffDate = new Date(Date.now() - this.ttlMs).toISOString();

    const stmt = this.db.prepare(`
      DELETE FROM link_cache
      WHERE checked_at < ?
    `);

    const result = stmt.run(cutoffDate);
    return result.changes;
  }

  /**
   * Get cache statistics
   */
  getStats(): { totalEntries: number; validEntries: number; expiredEntries: number } {
    const cutoffDate = new Date(Date.now() - this.ttlMs).toISOString();

    const totalStmt = this.db.prepare('SELECT COUNT(*) as count FROM link_cache');
    const validStmt = this.db.prepare('SELECT COUNT(*) as count FROM link_cache WHERE checked_at >= ?');

    const total = (totalStmt.get() as { count: number }).count;
    const valid = (validStmt.get(cutoffDate) as { count: number }).count;

    return {
      totalEntries: total,
      validEntries: valid,
      expiredEntries: total - valid,
    };
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.db.prepare('DELETE FROM link_cache').run();
  }

  /**
   * Close the database connection
   */
  close(): void {
    this.db.close();
  }
}

/**
 * Create a link cache instance
 * @param options - Cache options
 * @returns LinkCache instance
 */
export function createLinkCache(options?: Partial<LinkCacheOptions>): LinkCache {
  return new LinkCache(options);
}
