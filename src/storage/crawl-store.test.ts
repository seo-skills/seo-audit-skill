import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { saveCrawl, loadCrawl, listCrawls, getLatestCrawl } from './crawl-store.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('crawl-store', () => {
  const testDir = path.join(os.tmpdir(), 'seomator-crawl-test-' + Date.now());

  beforeEach(() => {
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it('should save and load a crawl', () => {
    const crawl = {
      id: '2025-01-23-abc123',
      url: 'https://example.com',
      project: 'test',
      timestamp: new Date().toISOString(),
      config: {},
      pages: [],
      stats: { totalPages: 0, duration: 0, errorCount: 0 },
    };

    saveCrawl(testDir, crawl);
    const loaded = loadCrawl(testDir, crawl.id);

    expect(loaded).toEqual(crawl);
  });

  it('should list all crawls', () => {
    const crawl1 = {
      id: '2025-01-23-aaa111',
      url: 'https://example.com',
      project: 'test',
      timestamp: '2025-01-23T10:00:00Z',
      config: {},
      pages: [],
      stats: { totalPages: 0, duration: 0, errorCount: 0 },
    };
    const crawl2 = {
      id: '2025-01-23-bbb222',
      url: 'https://example.com',
      project: 'test',
      timestamp: '2025-01-23T11:00:00Z',
      config: {},
      pages: [],
      stats: { totalPages: 0, duration: 0, errorCount: 0 },
    };

    saveCrawl(testDir, crawl1);
    saveCrawl(testDir, crawl2);

    const list = listCrawls(testDir);
    expect(list).toHaveLength(2);
  });

  it('should return null for non-existent crawl', () => {
    const loaded = loadCrawl(testDir, 'non-existent-id');
    expect(loaded).toBeNull();
  });

  it('should return empty array when no crawls exist', () => {
    const list = listCrawls(testDir);
    expect(list).toEqual([]);
  });

  it('should list crawls sorted by timestamp descending', () => {
    const crawl1 = {
      id: '2025-01-23-aaa111',
      url: 'https://example.com',
      project: 'test',
      timestamp: '2025-01-23T10:00:00Z',
      config: {},
      pages: [],
      stats: { totalPages: 5, duration: 1000, errorCount: 0 },
    };
    const crawl2 = {
      id: '2025-01-23-bbb222',
      url: 'https://example.com',
      project: 'test',
      timestamp: '2025-01-23T11:00:00Z',
      config: {},
      pages: [],
      stats: { totalPages: 10, duration: 2000, errorCount: 1 },
    };

    saveCrawl(testDir, crawl1);
    saveCrawl(testDir, crawl2);

    const list = listCrawls(testDir);
    expect(list[0].id).toBe('2025-01-23-bbb222'); // More recent first
    expect(list[1].id).toBe('2025-01-23-aaa111');
  });

  it('should get the latest crawl', () => {
    const crawl1 = {
      id: '2025-01-23-aaa111',
      url: 'https://example.com',
      project: 'test',
      timestamp: '2025-01-23T10:00:00Z',
      config: {},
      pages: [],
      stats: { totalPages: 0, duration: 0, errorCount: 0 },
    };
    const crawl2 = {
      id: '2025-01-23-bbb222',
      url: 'https://example.com',
      project: 'test',
      timestamp: '2025-01-23T11:00:00Z',
      config: {},
      pages: [],
      stats: { totalPages: 0, duration: 0, errorCount: 0 },
    };

    saveCrawl(testDir, crawl1);
    saveCrawl(testDir, crawl2);

    const latest = getLatestCrawl(testDir);
    expect(latest?.id).toBe('2025-01-23-bbb222');
  });

  it('should return null when getting latest crawl from empty directory', () => {
    const latest = getLatestCrawl(testDir);
    expect(latest).toBeNull();
  });

  it('should include correct summary fields in list', () => {
    const crawl = {
      id: '2025-01-23-abc123',
      url: 'https://example.com',
      project: 'my-project',
      timestamp: '2025-01-23T10:00:00Z',
      config: { crawler: { max_pages: 20 } },
      pages: [
        { url: 'https://example.com', status: 200, html: '', headers: {}, depth: 0, loadTime: 100 },
      ],
      stats: { totalPages: 15, duration: 5000, errorCount: 2 },
    };

    saveCrawl(testDir, crawl);
    const list = listCrawls(testDir);

    expect(list).toHaveLength(1);
    expect(list[0]).toEqual({
      id: '2025-01-23-abc123',
      url: 'https://example.com',
      project: 'my-project',
      timestamp: '2025-01-23T10:00:00Z',
      totalPages: 15,
    });
  });
});
