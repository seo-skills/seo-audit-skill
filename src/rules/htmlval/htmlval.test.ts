import { describe, it, expect } from 'vitest';
import { titleOutsideHeadRule } from './title-outside-head.js';
import { baseUrlRule } from './base-url.js';
import { sizeLimitRule } from './size-limit.js';
import { createTestContext } from '../test-context.js';

/**
 * Create a mock AuditContext for testing
 */
function createContext(html: string, url = 'https://example.com') {
  return createTestContext(html, { url });
}

describe('HTML Validation Rules', () => {
  describe('titleOutsideHeadRule', () => {
    it('should pass when the title is inside <head>', async () => {
      const html = '<html><head><title>My Page</title></head><body></body></html>';
      const result = await titleOutsideHeadRule.run(createContext(html));
      expect(result.status).toBe('pass');
      expect(result.message).toContain('inside <head>');
    });

    it('should pass when no <title> element exists', async () => {
      const html = '<html><head></head><body></body></html>';
      const result = await titleOutsideHeadRule.run(createContext(html));
      expect(result.status).toBe('pass');
      expect(result.message).toContain('No <title> element found');
    });

    it('should fail when the title is inside <body>', async () => {
      const html =
        '<!doctype html><html><head><meta charset="utf-8"></head>' +
        '<body><title>Oh what a page title</title><p>content</p></body></html>';
      const result = await titleOutsideHeadRule.run(createContext(html));
      expect(result.status).toBe('fail');
      expect(result.score).toBe(0);
      expect(result.message).toContain('outside of <head>');
      expect(result.details?.count).toBe(1);
      expect(result.details?.titles).toEqual(['Oh what a page title']);
    });

    it('should fail when a second title sits in <body> alongside one in <head>', async () => {
      const html =
        '<html><head><title>Good</title></head>' +
        '<body><title>Bad</title></body></html>';
      const result = await titleOutsideHeadRule.run(createContext(html));
      expect(result.status).toBe('fail');
      expect(result.details?.titles).toEqual(['Bad']);
    });
  });

  describe('baseUrlRule', () => {
    it('should pass when no <base> element exists', async () => {
      const html = '<html><head><title>Page</title></head><body></body></html>';
      const result = await baseUrlRule.run(createContext(html));
      expect(result.status).toBe('pass');
      expect(result.message).toContain('No <base> element found');
    });

    it('should pass with a single valid base href', async () => {
      const html = '<html><head><base href="https://example.com/"></head><body></body></html>';
      const result = await baseUrlRule.run(createContext(html));
      expect(result.status).toBe('pass');
      expect(result.message).toContain('single valid <base> element');
    });

    it('should fail when the base href is empty', async () => {
      const html = '<html><head><base href=""></head><body></body></html>';
      const result = await baseUrlRule.run(createContext(html));
      expect(result.status).toBe('fail');
      expect(result.score).toBe(0);
      expect(result.message).toContain('empty or malformed');
    });

    it('should fail when the base href attribute is missing', async () => {
      const html = '<html><head><base></head><body></body></html>';
      const result = await baseUrlRule.run(createContext(html));
      expect(result.status).toBe('fail');
    });

    it('should fail when the base href uses an invalid protocol', async () => {
      const html = '<html><head><base href="htttps://example.com"></head><body></body></html>';
      const result = await baseUrlRule.run(createContext(html));
      expect(result.status).toBe('fail');
      expect(result.details?.problems).toEqual([
        { href: 'htttps://example.com', reason: 'invalid-protocol' },
      ]);
    });

    it('should fail when the base href contains whitespace', async () => {
      const html = '<html><head><base href="https://exam ple.com"></head><body></body></html>';
      const result = await baseUrlRule.run(createContext(html));
      expect(result.status).toBe('fail');
      expect(result.details?.problems).toEqual([
        { href: 'https://exam ple.com', reason: 'malformed' },
      ]);
    });

    it('should fail with multiple <base> elements using different hrefs', async () => {
      const html =
        '<html><head><base href="https://example.com"><base href="https://other.com">' +
        '</head><body></body></html>';
      const result = await baseUrlRule.run(createContext(html));
      expect(result.status).toBe('fail');
      expect(result.message).toContain('different hrefs');
      expect(result.details?.count).toBe(2);
    });

    it('should warn with multiple <base> elements using the same href', async () => {
      const html =
        '<html><head><base href="https://example.com"><base href="https://example.com">' +
        '</head><body></body></html>';
      const result = await baseUrlRule.run(createContext(html));
      expect(result.status).toBe('warn');
      expect(result.score).toBe(50);
      expect(result.message).toContain('Only one <base> element is allowed');
    });
  });

  describe('sizeLimitRule', () => {
    it('should pass for a small document', async () => {
      const html = '<html><head><title>Page</title></head><body>Hello</body></html>';
      const result = await sizeLimitRule.run(createContext(html));
      expect(result.status).toBe('pass');
      expect(result.score).toBe(100);
    });

    it('should warn above 250 KB', async () => {
      const html = `<html><body>${'a'.repeat(260 * 1024)}</body></html>`;
      const result = await sizeLimitRule.run(createContext(html));
      expect(result.status).toBe('warn');
      expect(result.message).toContain('250 KB');
    });

    it('should fail above 500 KB with the performance message', async () => {
      const html = `<html><body>${'a'.repeat(520 * 1024)}</body></html>`;
      const result = await sizeLimitRule.run(createContext(html));
      expect(result.status).toBe('fail');
      expect(result.message).toContain('500 KB');
      expect(result.message).not.toContain('Googlebot');
    });

    it('should fail above ~2 MB with the Googlebot crawl-cutoff message', async () => {
      const html = `<html><body>${'a'.repeat(2 * 1024 * 1024 + 1024)}</body></html>`;
      const result = await sizeLimitRule.run(createContext(html));
      expect(result.status).toBe('fail');
      expect(result.score).toBe(0);
      expect(result.message).toContain('Googlebot');
      expect(result.message).toContain('2 MB');
      expect(result.details?.threshold).toBe('~2 MB');
    });
  });
});
