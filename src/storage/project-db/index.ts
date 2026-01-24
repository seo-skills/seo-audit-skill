import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import { getProjectDbPath, getProjectDbDir, extractDomain } from '../paths.js';
import { initializeProjectSchema, getProjectDbStats } from './schema.js';
import * as projects from './projects.js';
import * as crawls from './crawls.js';
import * as pages from './pages.js';
import * as links from './links.js';
import * as images from './images.js';
import type {
  HydratedProject,
  HydratedCrawl,
  HydratedPage,
  HydratedPageWithHtml,
  HydratedLink,
  HydratedImage,
  CrawlSummary,
  CrawlStats,
  CrawlStatus,
  CrawlQueryOptions,
  PageQueryOptions,
  CreateCrawlInput,
  InsertPageInput,
  InsertLinkInput,
  InsertImageInput,
} from '../types.js';
import type { PartialSeomatorConfig } from '../../config/schema.js';

/**
 * Per-project SQLite database for storing crawl data
 *
 * Each domain gets its own database at ~/.seomator/projects/<domain>/project.db
 * This enables:
 * - Data isolation between projects
 * - Easy cleanup (delete directory)
 * - Parallel operations on different domains
 */
export class ProjectDatabase {
  private db: Database.Database;
  private domain: string;
  private projectId: number | null = null;

  /**
   * Open or create a project database
   *
   * @param domain - Domain name or full URL (domain will be extracted)
   */
  constructor(domain: string) {
    // Extract domain from URL if needed
    this.domain = domain.includes('://') ? extractDomain(domain) : domain;

    // Ensure project directory exists
    const dbDir = getProjectDbDir(this.domain);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    // Open database
    const dbPath = getProjectDbPath(this.domain);
    this.db = new Database(dbPath);

    // Initialize schema
    initializeProjectSchema(this.db);
  }

  /**
   * Get the underlying database instance (for advanced operations)
   */
  getDb(): Database.Database {
    return this.db;
  }

  /**
   * Get the domain this database is for
   */
  getDomain(): string {
    return this.domain;
  }

  /**
   * Close the database connection
   */
  close(): void {
    this.db.close();
  }

  /**
   * Get database statistics
   */
  getStats(): {
    projects: number;
    crawls: number;
    pages: number;
    links: number;
    images: number;
    dbSizeBytes: number;
  } {
    return getProjectDbStats(this.db);
  }

  // ===========================================================================
  // Project Operations
  // ===========================================================================

  /**
   * Get or create the project for this domain
   */
  getOrCreateProject(name?: string): HydratedProject {
    const project = projects.getOrCreateProject(this.db, this.domain, name);
    this.projectId = project.id;
    return project;
  }

  /**
   * Get the current project
   */
  getProject(): HydratedProject | null {
    return projects.getProjectByDomain(this.db, this.domain);
  }

  /**
   * Update project settings
   */
  updateProject(updates: {
    name?: string;
    config?: PartialSeomatorConfig;
  }): HydratedProject | null {
    if (!this.projectId) {
      const project = this.getProject();
      if (!project) return null;
      this.projectId = project.id;
    }
    return projects.updateProject(this.db, this.projectId, updates);
  }

  // ===========================================================================
  // Crawl Operations
  // ===========================================================================

  /**
   * Create a new crawl
   */
  createCrawl(input: CreateCrawlInput): HydratedCrawl {
    if (!this.projectId) {
      const project = this.getOrCreateProject();
      this.projectId = project.id;
    }
    return crawls.createCrawl(this.db, this.projectId, input);
  }

  /**
   * Get a crawl by its ID (e.g., "2024-01-23-abc123")
   */
  getCrawl(crawlId: string): HydratedCrawl | null {
    return crawls.getCrawl(this.db, crawlId);
  }

  /**
   * Get the most recent crawl
   */
  getLatestCrawl(): HydratedCrawl | null {
    if (!this.projectId) {
      const project = this.getProject();
      if (!project) return null;
      this.projectId = project.id;
    }
    return crawls.getLatestCrawl(this.db, this.projectId);
  }

  /**
   * List crawls for this project
   */
  listCrawls(options?: CrawlQueryOptions): CrawlSummary[] {
    if (!this.projectId) {
      const project = this.getProject();
      if (!project) return [];
      this.projectId = project.id;
    }
    return crawls.listCrawls(this.db, this.projectId, options);
  }

  /**
   * Complete a crawl with final stats
   */
  completeCrawl(crawlId: string, stats: CrawlStats): HydratedCrawl | null {
    return crawls.completeCrawl(this.db, crawlId, stats);
  }

  /**
   * Fail a crawl with error
   */
  failCrawl(
    crawlId: string,
    errorMessage: string,
    stats?: Partial<CrawlStats>
  ): HydratedCrawl | null {
    return crawls.failCrawl(this.db, crawlId, errorMessage, stats);
  }

  /**
   * Cancel a crawl
   */
  cancelCrawl(crawlId: string, stats?: Partial<CrawlStats>): HydratedCrawl | null {
    return crawls.cancelCrawl(this.db, crawlId, stats);
  }

  /**
   * Delete a crawl and all associated data
   */
  deleteCrawl(crawlId: string): boolean {
    return crawls.deleteCrawl(this.db, crawlId);
  }

  // ===========================================================================
  // Page Operations
  // ===========================================================================

  /**
   * Insert a page into a crawl
   */
  insertPage(crawlId: number, input: InsertPageInput): HydratedPage {
    return pages.insertPage(this.db, crawlId, input);
  }

  /**
   * Insert multiple pages in a transaction
   */
  insertPages(crawlId: number, pageInputs: InsertPageInput[]): number {
    return pages.insertPages(this.db, crawlId, pageInputs);
  }

  /**
   * Get a page by ID (without HTML)
   */
  getPage(pageId: number): HydratedPage | null {
    return pages.getPage(this.db, pageId);
  }

  /**
   * Get a page with HTML content
   */
  getPageWithHtml(pageId: number): HydratedPageWithHtml | null {
    return pages.getPageWithHtml(this.db, pageId);
  }

  /**
   * Get just the HTML for a page
   */
  getPageHtml(pageId: number): string | null {
    return pages.getPageHtml(this.db, pageId);
  }

  /**
   * List pages for a crawl
   */
  listPages(crawlId: number, options?: PageQueryOptions): HydratedPage[] {
    return pages.listPages(this.db, crawlId, options);
  }

  /**
   * Get pages with errors
   */
  getErrorPages(crawlId: number): HydratedPage[] {
    return pages.getErrorPages(this.db, crawlId);
  }

  /**
   * Get page count for a crawl
   */
  getPageCount(crawlId: number): number {
    return pages.getPageCount(this.db, crawlId);
  }

  /**
   * Get HTML storage statistics
   */
  getHtmlStorageStats(
    crawlId: number
  ): { originalBytes: number; storedBytes: number; compressionRatio: number } {
    return pages.getHtmlStorageStats(this.db, crawlId);
  }

  // ===========================================================================
  // Link Operations
  // ===========================================================================

  /**
   * Insert links for a page
   */
  insertLinks(pageId: number, linkInputs: InsertLinkInput[]): number {
    return links.insertLinks(this.db, pageId, linkInputs);
  }

  /**
   * Get links for a page
   */
  getLinksByPage(pageId: number): HydratedLink[] {
    return links.getLinksByPage(this.db, pageId);
  }

  /**
   * Get broken links for a crawl
   */
  getBrokenLinks(crawlId: number): Array<HydratedLink & { sourceUrl: string }> {
    return links.getBrokenLinks(this.db, crawlId);
  }

  /**
   * Get unique external links for a crawl
   */
  getUniqueExternalLinks(crawlId: number): string[] {
    return links.getUniqueExternalLinks(this.db, crawlId);
  }

  /**
   * Update link statuses after checking
   */
  updateLinkStatuses(
    updates: Array<{ linkId: number; statusCode: number; error?: string }>
  ): void {
    links.updateLinkStatuses(this.db, updates);
  }

  /**
   * Get link statistics for a crawl
   */
  getLinkStats(crawlId: number): {
    total: number;
    internal: number;
    external: number;
    broken: number;
    nofollow: number;
  } {
    return links.getLinkStats(this.db, crawlId);
  }

  // ===========================================================================
  // Image Operations
  // ===========================================================================

  /**
   * Insert images for a page
   */
  insertImages(pageId: number, imageInputs: InsertImageInput[]): number {
    return images.insertImages(this.db, pageId, imageInputs);
  }

  /**
   * Get images for a page
   */
  getImagesByPage(pageId: number): HydratedImage[] {
    return images.getImagesByPage(this.db, pageId);
  }

  /**
   * Get images without alt text
   */
  getImagesWithoutAlt(
    crawlId: number
  ): Array<HydratedImage & { sourceUrl: string }> {
    return images.getImagesWithoutAlt(this.db, crawlId);
  }

  /**
   * Get images without dimensions
   */
  getImagesWithoutDimensions(
    crawlId: number
  ): Array<HydratedImage & { sourceUrl: string }> {
    return images.getImagesWithoutDimensions(this.db, crawlId);
  }

  /**
   * Get image statistics for a crawl
   */
  getImageStats(crawlId: number): {
    total: number;
    withAlt: number;
    withoutAlt: number;
    withDimensions: number;
    lazyLoaded: number;
    totalFileSize: number;
  } {
    return images.getImageStats(this.db, crawlId);
  }

  /**
   * Get image format distribution
   */
  getImageFormatDistribution(
    crawlId: number
  ): Array<{ format: string; count: number }> {
    return images.getImageFormatDistribution(this.db, crawlId);
  }
}

/**
 * Open a project database for a domain
 *
 * @param domainOrUrl - Domain name or URL
 * @returns ProjectDatabase instance
 */
export function openProjectDatabase(domainOrUrl: string): ProjectDatabase {
  return new ProjectDatabase(domainOrUrl);
}

// Re-export types
export type {
  HydratedProject,
  HydratedCrawl,
  HydratedPage,
  HydratedPageWithHtml,
  HydratedLink,
  HydratedImage,
  CrawlSummary,
  CrawlStats,
  CrawlStatus,
  CrawlQueryOptions,
  PageQueryOptions,
  CreateCrawlInput,
  InsertPageInput,
  InsertLinkInput,
  InsertImageInput,
};
