import { describe, it, expect } from 'vitest';
import { slugKeywordsRule } from './slug-keywords.js';
import { stopWordsRule } from './stop-words.js';
import type { AuditContext } from '../../types.js';

// Helper to create minimal AuditContext
function createContext(url: string): AuditContext {
  return {
    url,
    html: '<html><body></body></html>',
    $: null as any,
    headers: {},
    links: [],
    images: [],
    statusCode: 200,
    responseTime: 100,
    redirectChain: [],
  };
}

describe('slugKeywordsRule', () => {
  it('should pass for descriptive URL slugs', async () => {
    const context = createContext('https://example.com/blue-running-shoes');
    const result = await slugKeywordsRule.run(context);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('descriptive keywords');
  });

  it('should pass for root URL', async () => {
    const context = createContext('https://example.com/');
    const result = await slugKeywordsRule.run(context);
    expect(result.status).toBe('pass');
  });

  it('should fail for numeric ID URLs', async () => {
    const context = createContext('https://example.com/product-12345');
    const result = await slugKeywordsRule.run(context);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('generic identifiers');
  });

  it('should fail for pure numeric URLs', async () => {
    const context = createContext('https://example.com/123456');
    const result = await slugKeywordsRule.run(context);
    expect(result.status).toBe('fail');
  });

  it('should fail for UUID URLs', async () => {
    const context = createContext(
      'https://example.com/550e8400-e29b-41d4-a716-446655440000'
    );
    const result = await slugKeywordsRule.run(context);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('generic identifiers');
  });

  it('should fail for dynamic parameter URLs', async () => {
    const context = createContext('https://example.com/?p=123');
    const result = await slugKeywordsRule.run(context);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('dynamic parameters');
  });

  it('should pass for multi-segment descriptive URLs', async () => {
    const context = createContext(
      'https://example.com/blog/seo-tips-for-beginners'
    );
    const result = await slugKeywordsRule.run(context);
    expect(result.status).toBe('pass');
  });

  it('should warn for ambiguous hash-like URLs', async () => {
    const context = createContext('https://example.com/a1b2c3d4e5f6g7h8');
    const result = await slugKeywordsRule.run(context);
    // This is ambiguous - contains letters but no clear word pattern
    expect(result.status).toBe('warn');
  });

  it('should fail for CMS node URLs', async () => {
    const context = createContext('https://example.com/node/123');
    const result = await slugKeywordsRule.run(context);
    expect(result.status).toBe('fail');
  });
});

describe('stopWordsRule', () => {
  it('should pass for URLs without stop words', async () => {
    const context = createContext('https://example.com/best-running-shoes');
    const result = await stopWordsRule.run(context);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('no stop words');
  });

  it('should pass for root URL', async () => {
    const context = createContext('https://example.com/');
    const result = await stopWordsRule.run(context);
    expect(result.status).toBe('pass');
  });

  it('should warn for high stop word ratio', async () => {
    const context = createContext(
      'https://example.com/the-best-of-the-running-shoes-for-you'
    );
    const result = await stopWordsRule.run(context);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('stop words');
  });

  it('should pass for acceptable stop word ratio', async () => {
    const context = createContext(
      'https://example.com/guide-to-running-shoes'
    );
    const result = await stopWordsRule.run(context);
    // 'to' is a stop word but ratio is low
    expect(result.status).toBe('pass');
  });

  it('should detect common stop words', async () => {
    const context = createContext(
      'https://example.com/a-guide-to-the-best-shoes'
    );
    const result = await stopWordsRule.run(context);
    expect(result.details?.stopWordsFound).toContain('a');
    expect(result.details?.stopWordsFound).toContain('to');
    expect(result.details?.stopWordsFound).toContain('the');
  });

  it('should keep how-to compound words', async () => {
    const context = createContext('https://example.com/how-to-run-faster');
    const result = await stopWordsRule.run(context);
    // 'how' and 'to' should not be counted as stop words in 'how-to'
    expect(result.status).toBe('pass');
  });

  it('should provide suggestions', async () => {
    const context = createContext(
      'https://example.com/the-best-running-shoes-for-you'
    );
    const result = await stopWordsRule.run(context);
    expect(result.details?.suggestions).toBeDefined();
    expect((result.details?.suggestions as string[]).length).toBeGreaterThan(0);
  });

  it('should handle multi-segment URLs', async () => {
    const context = createContext(
      'https://example.com/blog/articles/the-ultimate-guide'
    );
    const result = await stopWordsRule.run(context);
    expect(result.details?.words).toContain('blog');
    expect(result.details?.words).toContain('articles');
    expect(result.details?.words).toContain('the');
  });
});
