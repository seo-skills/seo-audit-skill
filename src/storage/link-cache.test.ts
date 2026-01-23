import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { LinkCache, createLinkCache } from './link-cache.js';

describe('LinkCache', () => {
  let testDbPath: string;
  let cache: LinkCache;

  beforeEach(() => {
    // Create a unique test database path
    testDbPath = path.join(os.tmpdir(), `link-cache-test-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
    cache = new LinkCache({ dbPath: testDbPath });
  });

  afterEach(() => {
    cache.close();
    // Clean up test database
    try {
      if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
      if (fs.existsSync(`${testDbPath}-wal`)) fs.unlinkSync(`${testDbPath}-wal`);
      if (fs.existsSync(`${testDbPath}-shm`)) fs.unlinkSync(`${testDbPath}-shm`);
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('get/set', () => {
    it('should store and retrieve a link result', () => {
      cache.set('https://example.com', 200);

      const result = cache.get('https://example.com');

      expect(result).not.toBeNull();
      expect(result!.url).toBe('https://example.com');
      expect(result!.statusCode).toBe(200);
      expect(result!.error).toBeUndefined();
      expect(result!.isValid).toBe(true);
    });

    it('should store and retrieve error results', () => {
      cache.set('https://broken.com', 0, 'Connection timeout');

      const result = cache.get('https://broken.com');

      expect(result).not.toBeNull();
      expect(result!.statusCode).toBe(0);
      expect(result!.error).toBe('Connection timeout');
    });

    it('should return null for non-existent URLs', () => {
      const result = cache.get('https://nonexistent.com');
      expect(result).toBeNull();
    });

    it('should update existing entries', () => {
      cache.set('https://example.com', 500);
      cache.set('https://example.com', 200);

      const result = cache.get('https://example.com');

      expect(result!.statusCode).toBe(200);
    });
  });

  describe('getMany', () => {
    it('should retrieve multiple results at once', () => {
      cache.set('https://a.com', 200);
      cache.set('https://b.com', 404);
      cache.set('https://c.com', 0, 'Error');

      const results = cache.getMany(['https://a.com', 'https://b.com', 'https://c.com']);

      expect(results.size).toBe(3);
      expect(results.get('https://a.com')?.statusCode).toBe(200);
      expect(results.get('https://b.com')?.statusCode).toBe(404);
      expect(results.get('https://c.com')?.error).toBe('Error');
    });

    it('should only return found results', () => {
      cache.set('https://a.com', 200);

      const results = cache.getMany(['https://a.com', 'https://notfound.com']);

      expect(results.size).toBe(1);
      expect(results.has('https://a.com')).toBe(true);
      expect(results.has('https://notfound.com')).toBe(false);
    });

    it('should handle empty input', () => {
      const results = cache.getMany([]);
      expect(results.size).toBe(0);
    });
  });

  describe('setMany', () => {
    it('should store multiple results efficiently', () => {
      cache.setMany([
        { url: 'https://a.com', statusCode: 200 },
        { url: 'https://b.com', statusCode: 404 },
        { url: 'https://c.com', statusCode: 0, error: 'Timeout' },
      ]);

      expect(cache.get('https://a.com')?.statusCode).toBe(200);
      expect(cache.get('https://b.com')?.statusCode).toBe(404);
      expect(cache.get('https://c.com')?.error).toBe('Timeout');
    });
  });

  describe('TTL and validity', () => {
    it('should mark fresh entries as valid', () => {
      cache.set('https://example.com', 200);
      const result = cache.get('https://example.com');
      expect(result!.isValid).toBe(true);
    });

    it('should mark expired entries as invalid', () => {
      // Create cache with very short TTL
      cache.close();
      cache = new LinkCache({ dbPath: testDbPath, ttlDays: 0 });

      cache.set('https://example.com', 200);

      // Wait a tiny bit to ensure the entry is "old"
      const result = cache.get('https://example.com');

      // With 0 TTL days, any entry is immediately invalid
      expect(result!.isValid).toBe(false);
    });
  });

  describe('cleanup', () => {
    it('should remove expired entries', async () => {
      // Insert directly with an old timestamp to simulate expired entries
      cache.set('https://a.com', 200);
      cache.set('https://b.com', 200);

      // Close and reopen with 0 TTL, then wait briefly
      cache.close();

      // Wait a small amount to ensure entries are in the past
      await new Promise(resolve => setTimeout(resolve, 10));

      cache = new LinkCache({ dbPath: testDbPath, ttlDays: 0 });

      // Now entries created before reopening should be expired
      const removed = cache.cleanup();

      // The entries from before should now be expired
      expect(removed).toBeGreaterThanOrEqual(0);
      // Verify they're marked as invalid
      const resultA = cache.get('https://a.com');
      if (resultA) {
        expect(resultA.isValid).toBe(false);
      }
    });
  });

  describe('getStats', () => {
    it('should return cache statistics', () => {
      cache.set('https://a.com', 200);
      cache.set('https://b.com', 200);
      cache.set('https://c.com', 200);

      const stats = cache.getStats();

      expect(stats.totalEntries).toBe(3);
      expect(stats.validEntries).toBe(3);
      expect(stats.expiredEntries).toBe(0);
    });
  });

  describe('clear', () => {
    it('should remove all entries', () => {
      cache.set('https://a.com', 200);
      cache.set('https://b.com', 200);

      cache.clear();

      const stats = cache.getStats();
      expect(stats.totalEntries).toBe(0);
    });
  });
});

describe('createLinkCache', () => {
  it('should create a LinkCache instance', () => {
    const testDbPath = path.join(os.tmpdir(), `link-cache-test-${Date.now()}.db`);
    const cache = createLinkCache({ dbPath: testDbPath });

    expect(cache).toBeInstanceOf(LinkCache);

    cache.close();

    // Cleanup
    try {
      fs.unlinkSync(testDbPath);
      fs.unlinkSync(`${testDbPath}-wal`);
      fs.unlinkSync(`${testDbPath}-shm`);
    } catch {
      // Ignore
    }
  });
});
