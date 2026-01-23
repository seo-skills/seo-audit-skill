import * as fs from 'fs';
import * as path from 'path';
import type { PartialSeomatorConfig } from '../config/schema.js';
import type { CoreWebVitals } from '../types.js';
import { getCrawlsDir, generateId } from './paths.js';

/**
 * Stored page data from a crawl
 */
export interface StoredPage {
  url: string;
  status: number;
  html: string;
  headers: Record<string, string>;
  depth: number;
  loadTime: number;
  cwv?: CoreWebVitals;
}

/**
 * Stored crawl data
 */
export interface StoredCrawl {
  id: string;
  url: string;
  project: string;
  timestamp: string;
  config: PartialSeomatorConfig;
  pages: StoredPage[];
  stats: {
    totalPages: number;
    duration: number;
    errorCount: number;
  };
}

/**
 * Crawl summary for listing
 */
export interface CrawlSummary {
  id: string;
  url: string;
  project: string;
  timestamp: string;
  totalPages: number;
}

/**
 * Ensure crawls directory exists
 */
function ensureCrawlsDir(baseDir: string): string {
  const crawlsDir = getCrawlsDir(baseDir);
  if (!fs.existsSync(crawlsDir)) {
    fs.mkdirSync(crawlsDir, { recursive: true });
  }
  return crawlsDir;
}

/**
 * Save a crawl to disk
 */
export function saveCrawl(baseDir: string, crawl: StoredCrawl): string {
  const crawlsDir = ensureCrawlsDir(baseDir);
  const filePath = path.join(crawlsDir, `${crawl.id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(crawl, null, 2), 'utf-8');
  return crawl.id;
}

/**
 * Load a crawl from disk
 */
export function loadCrawl(baseDir: string, id: string): StoredCrawl | null {
  const crawlsDir = getCrawlsDir(baseDir);
  const filePath = path.join(crawlsDir, `${id}.json`);

  if (!fs.existsSync(filePath)) {
    return null;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content);
}

/**
 * List all crawls
 */
export function listCrawls(baseDir: string): CrawlSummary[] {
  const crawlsDir = getCrawlsDir(baseDir);

  if (!fs.existsSync(crawlsDir)) {
    return [];
  }

  const files = fs.readdirSync(crawlsDir).filter(f => f.endsWith('.json'));
  const summaries: CrawlSummary[] = [];

  for (const file of files) {
    const filePath = path.join(crawlsDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const crawl: StoredCrawl = JSON.parse(content);

    summaries.push({
      id: crawl.id,
      url: crawl.url,
      project: crawl.project,
      timestamp: crawl.timestamp,
      totalPages: crawl.stats.totalPages,
    });
  }

  // Sort by timestamp descending
  return summaries.sort((a, b) =>
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

/**
 * Get the most recent crawl
 */
export function getLatestCrawl(baseDir: string): StoredCrawl | null {
  const list = listCrawls(baseDir);
  if (list.length === 0) {
    return null;
  }
  return loadCrawl(baseDir, list[0].id);
}

/**
 * Create a new crawl record
 */
export function createCrawl(
  url: string,
  project: string,
  config: PartialSeomatorConfig
): StoredCrawl {
  return {
    id: generateId(),
    url,
    project,
    timestamp: new Date().toISOString(),
    config,
    pages: [],
    stats: {
      totalPages: 0,
      duration: 0,
      errorCount: 0,
    },
  };
}
