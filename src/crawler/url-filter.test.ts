import { describe, it, expect } from 'vitest';
import { UrlFilter, createUrlFilter, globToRegex } from './url-filter.js';

describe('globToRegex', () => {
  it('should match literal strings', () => {
    const regex = globToRegex('/admin');
    expect(regex.test('/admin')).toBe(true);
    expect(regex.test('/admin/')).toBe(false);
    expect(regex.test('/admin/users')).toBe(false);
  });

  it('should handle * (any except /)', () => {
    const regex = globToRegex('/admin/*');
    expect(regex.test('/admin/users')).toBe(true);
    expect(regex.test('/admin/settings')).toBe(true);
    expect(regex.test('/admin/users/edit')).toBe(false);
    expect(regex.test('/admin/')).toBe(true);
  });

  it('should handle ** (any including /)', () => {
    const regex = globToRegex('/admin/**');
    expect(regex.test('/admin/users')).toBe(true);
    expect(regex.test('/admin/users/edit')).toBe(true);
    expect(regex.test('/admin/users/edit/form')).toBe(true);
    expect(regex.test('/admin/')).toBe(true);
    expect(regex.test('/admin')).toBe(true);
  });

  it('should handle ? (single character)', () => {
    const regex = globToRegex('/page?');
    expect(regex.test('/page1')).toBe(true);
    expect(regex.test('/pageA')).toBe(true);
    expect(regex.test('/page')).toBe(false);
    expect(regex.test('/page12')).toBe(false);
  });

  it('should handle *.ext pattern', () => {
    const regex = globToRegex('/*.pdf');
    expect(regex.test('/doc.pdf')).toBe(true);
    expect(regex.test('/files/doc.pdf')).toBe(false); // * doesn't match /
  });

  it('should handle **/*.ext pattern', () => {
    const regex = globToRegex('**/*.pdf');
    expect(regex.test('/doc.pdf')).toBe(true);
    expect(regex.test('/files/doc.pdf')).toBe(true);
    expect(regex.test('/files/nested/doc.pdf')).toBe(true);
  });

  it('should escape special regex characters', () => {
    const regex = globToRegex('/path.to.file');
    expect(regex.test('/path.to.file')).toBe(true);
    expect(regex.test('/pathXtoXfile')).toBe(false);
  });
});

describe('UrlFilter', () => {
  describe('shouldCrawl', () => {
    it('should allow all URLs when no patterns are set', () => {
      const filter = new UrlFilter();

      expect(filter.shouldCrawl('https://example.com/')).toBe(true);
      expect(filter.shouldCrawl('https://example.com/page')).toBe(true);
      expect(filter.shouldCrawl('https://example.com/admin/users')).toBe(true);
    });

    it('should filter with include patterns', () => {
      const filter = new UrlFilter({
        include: ['/blog/**', '/products/**'],
      });

      expect(filter.shouldCrawl('https://example.com/blog/post-1')).toBe(true);
      expect(filter.shouldCrawl('https://example.com/products/item')).toBe(true);
      expect(filter.shouldCrawl('https://example.com/about')).toBe(false);
      expect(filter.shouldCrawl('https://example.com/admin')).toBe(false);
    });

    it('should filter with exclude patterns', () => {
      const filter = new UrlFilter({
        exclude: ['/admin/**', '/api/**'],
      });

      expect(filter.shouldCrawl('https://example.com/')).toBe(true);
      expect(filter.shouldCrawl('https://example.com/blog')).toBe(true);
      expect(filter.shouldCrawl('https://example.com/admin')).toBe(false);
      expect(filter.shouldCrawl('https://example.com/admin/users')).toBe(false);
      expect(filter.shouldCrawl('https://example.com/api/v1/users')).toBe(false);
    });

    it('should apply both include and exclude patterns', () => {
      const filter = new UrlFilter({
        include: ['/blog/**'],
        exclude: ['/blog/drafts/**'],
      });

      expect(filter.shouldCrawl('https://example.com/blog/post-1')).toBe(true);
      expect(filter.shouldCrawl('https://example.com/blog/archives')).toBe(true);
      expect(filter.shouldCrawl('https://example.com/blog/drafts/new')).toBe(false);
      expect(filter.shouldCrawl('https://example.com/about')).toBe(false);
    });

    it('should handle pathname input', () => {
      const filter = new UrlFilter({
        exclude: ['/admin/**'],
      });

      expect(filter.shouldCrawl('/page')).toBe(true);
      expect(filter.shouldCrawl('/admin/users')).toBe(false);
      expect(filter.shouldCrawl('admin/users')).toBe(false); // Auto-prefixes /
    });

    it('should match file extensions', () => {
      const filter = new UrlFilter({
        exclude: ['**/*.pdf', '**/*.doc'],
      });

      expect(filter.shouldCrawl('https://example.com/page')).toBe(true);
      expect(filter.shouldCrawl('https://example.com/docs/file.pdf')).toBe(false);
      expect(filter.shouldCrawl('https://example.com/docs/file.doc')).toBe(false);
    });
  });

  describe('normalizeUrl', () => {
    it('should remove hash fragments', () => {
      const filter = new UrlFilter();

      expect(filter.normalizeUrl('https://example.com/page#section'))
        .toBe('https://example.com/page');
    });

    it('should remove default tracking params', () => {
      const filter = new UrlFilter();

      expect(filter.normalizeUrl('https://example.com/page?utm_source=google&utm_medium=cpc'))
        .toBe('https://example.com/page');

      expect(filter.normalizeUrl('https://example.com/page?gclid=abc123'))
        .toBe('https://example.com/page');

      expect(filter.normalizeUrl('https://example.com/page?fbclid=xyz'))
        .toBe('https://example.com/page');
    });

    it('should keep non-tracking params', () => {
      const filter = new UrlFilter();

      expect(filter.normalizeUrl('https://example.com/search?q=hello'))
        .toBe('https://example.com/search?q=hello');

      expect(filter.normalizeUrl('https://example.com/page?id=123&utm_source=test'))
        .toBe('https://example.com/page?id=123');
    });

    it('should only keep allowed params when allowQueryParams is set', () => {
      const filter = new UrlFilter({
        allowQueryParams: ['page', 'sort'],
      });

      expect(filter.normalizeUrl('https://example.com/products?page=2&sort=name&filter=new'))
        .toBe('https://example.com/products?page=2&sort=name');
    });

    it('should sort query params for consistent normalization', () => {
      const filter = new UrlFilter({
        allowQueryParams: ['a', 'b', 'c'],
      });

      expect(filter.normalizeUrl('https://example.com/page?c=3&a=1&b=2'))
        .toBe('https://example.com/page?a=1&b=2&c=3');
    });

    it('should remove trailing slash except for root', () => {
      const filter = new UrlFilter();

      expect(filter.normalizeUrl('https://example.com/page/'))
        .toBe('https://example.com/page');

      expect(filter.normalizeUrl('https://example.com/'))
        .toBe('https://example.com/');
    });

    it('should handle custom drop prefixes', () => {
      const filter = new UrlFilter({
        dropQueryPrefixes: ['track_', 'ref_'],
      });

      expect(filter.normalizeUrl('https://example.com/page?track_source=email&ref_id=123&id=456'))
        .toBe('https://example.com/page?id=456');
    });

    it('should return original URL if invalid', () => {
      const filter = new UrlFilter();

      expect(filter.normalizeUrl('not-a-url')).toBe('not-a-url');
    });
  });

  describe('matchesPattern', () => {
    it('should check if URL matches a specific pattern', () => {
      const filter = new UrlFilter();

      expect(filter.matchesPattern('https://example.com/admin/users', '/admin/**')).toBe(true);
      expect(filter.matchesPattern('https://example.com/blog', '/admin/**')).toBe(false);
      expect(filter.matchesPattern('/admin/users', '/admin/**')).toBe(true);
    });
  });
});

describe('createUrlFilter', () => {
  it('should create a UrlFilter instance', () => {
    const filter = createUrlFilter({
      include: ['/blog/**'],
      exclude: ['/blog/drafts/**'],
    });

    expect(filter).toBeInstanceOf(UrlFilter);
    expect(filter.shouldCrawl('/blog/post')).toBe(true);
    expect(filter.shouldCrawl('/blog/drafts/new')).toBe(false);
  });

  it('should create instance with defaults when no options provided', () => {
    const filter = createUrlFilter();

    expect(filter).toBeInstanceOf(UrlFilter);
    expect(filter.shouldCrawl('/any/path')).toBe(true);
  });
});
