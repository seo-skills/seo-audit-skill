import type Database from 'better-sqlite3';

/**
 * SQL statements for creating the project database schema
 */
export const PROJECT_SCHEMA = `
-- Enable WAL mode for concurrent reads during writes
PRAGMA journal_mode = WAL;

-- Enable foreign key constraints
PRAGMA foreign_keys = ON;

-- Projects table - represents a single domain/website
CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY,
    domain TEXT NOT NULL UNIQUE,
    name TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    config_json TEXT
);

-- Crawls table - represents a single crawl session
CREATE TABLE IF NOT EXISTS crawls (
    id INTEGER PRIMARY KEY,
    crawl_id TEXT NOT NULL UNIQUE,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    start_url TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'running',
    started_at TEXT DEFAULT (datetime('now')),
    completed_at TEXT,
    config_json TEXT,
    stats_json TEXT,
    error_message TEXT
);

-- Pages table - stores crawled page data with optional compressed HTML
CREATE TABLE IF NOT EXISTS pages (
    id INTEGER PRIMARY KEY,
    crawl_id INTEGER NOT NULL REFERENCES crawls(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    url_hash TEXT NOT NULL,
    status_code INTEGER DEFAULT 0,
    depth INTEGER DEFAULT 0,
    content_type TEXT,
    html BLOB,
    html_compressed INTEGER DEFAULT 0,
    html_size INTEGER,
    headers_json TEXT,
    load_time_ms INTEGER,
    ttfb_ms INTEGER,
    cwv_lcp REAL,
    cwv_cls REAL,
    cwv_inp REAL,
    cwv_fcp REAL,
    cwv_ttfb REAL,
    error_message TEXT,
    crawled_at TEXT DEFAULT (datetime('now')),
    UNIQUE(crawl_id, url_hash)
);

-- Links table - stores links found on pages
CREATE TABLE IF NOT EXISTS links (
    id INTEGER PRIMARY KEY,
    page_id INTEGER NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
    href TEXT NOT NULL,
    href_hash TEXT NOT NULL,
    anchor_text TEXT,
    is_internal INTEGER DEFAULT 0,
    is_nofollow INTEGER DEFAULT 0,
    rel_value TEXT,
    target_status_code INTEGER,
    target_error TEXT
);

-- Images table - stores images found on pages
CREATE TABLE IF NOT EXISTS images (
    id INTEGER PRIMARY KEY,
    page_id INTEGER NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
    src TEXT NOT NULL,
    src_hash TEXT NOT NULL,
    alt TEXT,
    has_alt INTEGER DEFAULT 0,
    width TEXT,
    height TEXT,
    is_lazy_loaded INTEGER DEFAULT 0,
    loading_attr TEXT,
    srcset TEXT,
    file_size INTEGER,
    format TEXT
);

-- Frontier table - queue for resumable crawling
CREATE TABLE IF NOT EXISTS frontier (
    id INTEGER PRIMARY KEY,
    crawl_id INTEGER NOT NULL REFERENCES crawls(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    url_hash TEXT NOT NULL,
    depth INTEGER DEFAULT 0,
    priority INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending',
    discovered_at TEXT DEFAULT (datetime('now')),
    UNIQUE(crawl_id, url_hash)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_crawls_project ON crawls(project_id);
CREATE INDEX IF NOT EXISTS idx_crawls_status ON crawls(status);
CREATE INDEX IF NOT EXISTS idx_crawls_started ON crawls(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_pages_crawl ON pages(crawl_id);
CREATE INDEX IF NOT EXISTS idx_pages_status ON pages(crawl_id, status_code);
CREATE INDEX IF NOT EXISTS idx_pages_url_hash ON pages(url_hash);
CREATE INDEX IF NOT EXISTS idx_links_page ON links(page_id);
CREATE INDEX IF NOT EXISTS idx_links_internal ON links(page_id, is_internal);
CREATE INDEX IF NOT EXISTS idx_images_page ON images(page_id);
CREATE INDEX IF NOT EXISTS idx_frontier_crawl ON frontier(crawl_id);
CREATE INDEX IF NOT EXISTS idx_frontier_status ON frontier(crawl_id, status);
`;

/**
 * Initialize the project database schema
 * Uses db.prepare().run() for each statement to avoid shell-like exec
 *
 * @param db - better-sqlite3 database instance
 */
export function initializeProjectSchema(db: Database.Database): void {
  // Set pragmas first
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Create tables
  db.prepare(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY,
      domain TEXT NOT NULL UNIQUE,
      name TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      config_json TEXT
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS crawls (
      id INTEGER PRIMARY KEY,
      crawl_id TEXT NOT NULL UNIQUE,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      start_url TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'running',
      started_at TEXT DEFAULT (datetime('now')),
      completed_at TEXT,
      config_json TEXT,
      stats_json TEXT,
      error_message TEXT
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS pages (
      id INTEGER PRIMARY KEY,
      crawl_id INTEGER NOT NULL REFERENCES crawls(id) ON DELETE CASCADE,
      url TEXT NOT NULL,
      url_hash TEXT NOT NULL,
      status_code INTEGER DEFAULT 0,
      depth INTEGER DEFAULT 0,
      content_type TEXT,
      html BLOB,
      html_compressed INTEGER DEFAULT 0,
      html_size INTEGER,
      headers_json TEXT,
      load_time_ms INTEGER,
      ttfb_ms INTEGER,
      cwv_lcp REAL,
      cwv_cls REAL,
      cwv_inp REAL,
      cwv_fcp REAL,
      cwv_ttfb REAL,
      error_message TEXT,
      crawled_at TEXT DEFAULT (datetime('now')),
      UNIQUE(crawl_id, url_hash)
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS links (
      id INTEGER PRIMARY KEY,
      page_id INTEGER NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
      href TEXT NOT NULL,
      href_hash TEXT NOT NULL,
      anchor_text TEXT,
      is_internal INTEGER DEFAULT 0,
      is_nofollow INTEGER DEFAULT 0,
      rel_value TEXT,
      target_status_code INTEGER,
      target_error TEXT
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS images (
      id INTEGER PRIMARY KEY,
      page_id INTEGER NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
      src TEXT NOT NULL,
      src_hash TEXT NOT NULL,
      alt TEXT,
      has_alt INTEGER DEFAULT 0,
      width TEXT,
      height TEXT,
      is_lazy_loaded INTEGER DEFAULT 0,
      loading_attr TEXT,
      srcset TEXT,
      file_size INTEGER,
      format TEXT
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS frontier (
      id INTEGER PRIMARY KEY,
      crawl_id INTEGER NOT NULL REFERENCES crawls(id) ON DELETE CASCADE,
      url TEXT NOT NULL,
      url_hash TEXT NOT NULL,
      depth INTEGER DEFAULT 0,
      priority INTEGER DEFAULT 0,
      status TEXT DEFAULT 'pending',
      discovered_at TEXT DEFAULT (datetime('now')),
      UNIQUE(crawl_id, url_hash)
    )
  `).run();

  // Create indexes
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_crawls_project ON crawls(project_id)',
    'CREATE INDEX IF NOT EXISTS idx_crawls_status ON crawls(status)',
    'CREATE INDEX IF NOT EXISTS idx_crawls_started ON crawls(started_at DESC)',
    'CREATE INDEX IF NOT EXISTS idx_pages_crawl ON pages(crawl_id)',
    'CREATE INDEX IF NOT EXISTS idx_pages_status ON pages(crawl_id, status_code)',
    'CREATE INDEX IF NOT EXISTS idx_pages_url_hash ON pages(url_hash)',
    'CREATE INDEX IF NOT EXISTS idx_links_page ON links(page_id)',
    'CREATE INDEX IF NOT EXISTS idx_links_internal ON links(page_id, is_internal)',
    'CREATE INDEX IF NOT EXISTS idx_images_page ON images(page_id)',
    'CREATE INDEX IF NOT EXISTS idx_frontier_crawl ON frontier(crawl_id)',
    'CREATE INDEX IF NOT EXISTS idx_frontier_status ON frontier(crawl_id, status)',
  ];

  for (const idx of indexes) {
    db.prepare(idx).run();
  }
}

/**
 * Get database statistics
 */
export function getProjectDbStats(db: Database.Database): {
  projects: number;
  crawls: number;
  pages: number;
  links: number;
  images: number;
  dbSizeBytes: number;
} {
  const counts = db
    .prepare(
      `
    SELECT
      (SELECT COUNT(*) FROM projects) as projects,
      (SELECT COUNT(*) FROM crawls) as crawls,
      (SELECT COUNT(*) FROM pages) as pages,
      (SELECT COUNT(*) FROM links) as links,
      (SELECT COUNT(*) FROM images) as images
  `
    )
    .get() as {
    projects: number;
    crawls: number;
    pages: number;
    links: number;
    images: number;
  };

  // Get database file size
  const pageCount = db.prepare('PRAGMA page_count').get() as { page_count: number };
  const pageSize = db.prepare('PRAGMA page_size').get() as { page_size: number };
  const dbSizeBytes = (pageCount?.page_count ?? 0) * (pageSize?.page_size ?? 4096);

  return { ...counts, dbSizeBytes };
}
