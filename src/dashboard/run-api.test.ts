import { describe, it, expect } from 'vitest';
import { parseRunArgs } from './run-api.js';
import { ApiError } from './errors.js';

/** parseRunArgs throws ApiError; pull the details out for assertions */
function reject(body: Record<string, unknown>): ApiError {
  try {
    parseRunArgs(body);
  } catch (error) {
    if (error instanceof ApiError) return error;
    throw error;
  }
  throw new Error('expected a rejection');
}

describe('parseRunArgs', () => {
  it('accepts a URL alone', () => {
    expect(parseRunArgs({ url: 'https://example.com' })).toEqual({ url: 'https://example.com' });
  });

  it('reads options at the top level or nested, since both read naturally', () => {
    const flat = parseRunArgs({ url: 'https://example.com', crawl: true, maxPages: 25 });
    const nested = parseRunArgs({ url: 'https://example.com', options: { crawl: true, maxPages: 25 } });
    expect(flat).toEqual(nested);
    expect(flat.maxPages).toBe(25);
  });

  it('requires a URL', () => {
    expect(reject({}).details).toMatchObject({ option: 'url' });
    expect(reject({ url: '' }).status).toBe(400);
    expect(reject({ url: 42 }).status).toBe(400);
  });

  it('caps the URL length', () => {
    expect(reject({ url: `https://example.com/${'a'.repeat(2100)}` }).details).toMatchObject({ option: 'url' });
  });

  it('rejects an unknown option rather than ignoring it', () => {
    // An agent that mistypes maxPages should be told, not quietly given ten.
    const error = reject({ url: 'https://example.com', maxPage: 50 });
    expect(error.code).toBe('invalid-option');
    expect(error.details?.option).toBe('maxPage');
    expect(error.details?.allowed).toContain('maxPages');
  });

  it('rejects out-of-range numbers rather than clamping them', () => {
    for (const [option, value] of [
      ['maxPages', 0],
      ['maxPages', 5000],
      ['concurrency', 0],
      ['concurrency', 100],
      ['timeout', 10],
      ['timeout', 999_999],
    ] as const) {
      const error = reject({ url: 'https://example.com', [option]: value });
      expect(error.details?.option, `${option}=${value}`).toBe(option);
    }
  });

  it('rejects a non-integer where an integer is required', () => {
    expect(reject({ url: 'https://example.com', maxPages: 10.5 }).details).toMatchObject({ option: 'maxPages' });
    expect(reject({ url: 'https://example.com', maxPages: '10' }).details).toMatchObject({ option: 'maxPages' });
  });

  it('requires booleans to be booleans', () => {
    expect(reject({ url: 'https://example.com', crawl: 'yes' }).details).toMatchObject({
      option: 'crawl',
      allowed: 'true or false',
    });
    expect(parseRunArgs({ url: 'https://example.com', crawl: false }).crawl).toBe(false);
  });

  it('requires categories to be an array of strings', () => {
    expect(reject({ url: 'https://example.com', categories: 'core' }).details).toMatchObject({ option: 'categories' });
    expect(reject({ url: 'https://example.com', categories: [1, 2] }).details).toMatchObject({ option: 'categories' });
    expect(parseRunArgs({ url: 'https://example.com', categories: ['core'] }).categories).toEqual(['core']);
  });

  it('accepts save: false, which skips persistence for that run', () => {
    expect(parseRunArgs({ url: 'https://example.com', save: false }).save).toBe(false);
  });
});
