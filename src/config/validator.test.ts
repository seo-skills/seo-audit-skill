import { describe, it, expect } from 'vitest';
import { validateConfig, formatValidationResult } from './validator.js';
import { getDefaultConfig } from './defaults.js';

describe('validateConfig', () => {
  describe('valid configs', () => {
    it('should pass for default config', () => {
      const config = getDefaultConfig();
      const result = validateConfig(config);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should pass for empty partial config', () => {
      const result = validateConfig({});

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should pass for valid partial config', () => {
      const result = validateConfig({
        crawler: {
          max_pages: 50,
          concurrency: 5,
        },
        output: {
          format: 'json',
        },
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('crawler.max_pages validation', () => {
    it('should error for max_pages below minimum', () => {
      const result = validateConfig({
        crawler: { max_pages: 0 },
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].path).toBe('crawler.max_pages');
    });

    it('should error for max_pages above maximum', () => {
      const result = validateConfig({
        crawler: { max_pages: 20000 },
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].path).toBe('crawler.max_pages');
    });

    it('should warn for max_pages above 5000', () => {
      const result = validateConfig({
        crawler: { max_pages: 7500 },
      });

      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].path).toBe('crawler.max_pages');
      expect(result.warnings[0].message).toContain('high');
    });
  });

  describe('crawler.concurrency validation', () => {
    it('should error for concurrency below minimum', () => {
      const result = validateConfig({
        crawler: { concurrency: 0 },
      });

      expect(result.valid).toBe(false);
      expect(result.errors[0].path).toBe('crawler.concurrency');
    });

    it('should error for concurrency above maximum', () => {
      const result = validateConfig({
        crawler: { concurrency: 25 },
      });

      expect(result.valid).toBe(false);
      expect(result.errors[0].path).toBe('crawler.concurrency');
    });

    it('should warn for concurrency above 10', () => {
      const result = validateConfig({
        crawler: { concurrency: 15 },
      });

      expect(result.valid).toBe(true);
      expect(result.warnings.some(w => w.path === 'crawler.concurrency')).toBe(true);
    });
  });

  describe('crawler.per_host_concurrency validation', () => {
    it('should error for per_host_concurrency above 5', () => {
      const result = validateConfig({
        crawler: { per_host_concurrency: 10 },
      });

      expect(result.valid).toBe(false);
      expect(result.errors[0].path).toBe('crawler.per_host_concurrency');
    });
  });

  describe('external_links.cache_ttl_days validation', () => {
    it('should error for cache_ttl_days below 0', () => {
      const result = validateConfig({
        external_links: { cache_ttl_days: -1 },
      });

      expect(result.valid).toBe(false);
      expect(result.errors[0].path).toBe('external_links.cache_ttl_days');
    });

    it('should error for cache_ttl_days above 365', () => {
      const result = validateConfig({
        external_links: { cache_ttl_days: 400 },
      });

      expect(result.valid).toBe(false);
      expect(result.errors[0].path).toBe('external_links.cache_ttl_days');
    });

    it('should pass for valid cache_ttl_days', () => {
      const result = validateConfig({
        external_links: { cache_ttl_days: 30 },
      });

      expect(result.valid).toBe(true);
    });
  });

  describe('output.format validation', () => {
    it('should pass for valid formats', () => {
      for (const format of ['console', 'json', 'html', 'markdown']) {
        const result = validateConfig({
          output: { format: format as 'console' | 'json' | 'html' },
        });

        expect(result.valid).toBe(true);
      }
    });

    it('should error for invalid format', () => {
      const result = validateConfig({
        output: { format: 'xml' as 'console' },
      });

      expect(result.valid).toBe(false);
      expect(result.errors[0].path).toBe('output.format');
      expect(result.errors[0].message).toContain('console, json, html, markdown');
    });
  });

  describe('array field validation', () => {
    it('should pass for valid string arrays', () => {
      const result = validateConfig({
        crawler: {
          include: ['/blog/*', '/products/*'],
          exclude: ['/admin/*'],
        },
        rules: {
          enable: ['*'],
          disable: ['cwv-inp'],
        },
      });

      expect(result.valid).toBe(true);
    });

    it('should error for non-array value', () => {
      const result = validateConfig({
        crawler: { include: 'not-an-array' as unknown as string[] },
      });

      expect(result.valid).toBe(false);
      expect(result.errors[0].path).toBe('crawler.include');
    });

    it('should error for array with non-string elements', () => {
      const result = validateConfig({
        crawler: { include: ['/valid', 123 as unknown as string] },
      });

      expect(result.valid).toBe(false);
      expect(result.errors[0].path).toBe('crawler.include[1]');
    });
  });

  describe('boolean field validation', () => {
    it('should pass for valid booleans', () => {
      const result = validateConfig({
        crawler: {
          respect_robots: true,
          breadth_first: false,
        },
        external_links: {
          enabled: true,
        },
      });

      expect(result.valid).toBe(true);
    });

    it('should error for non-boolean value', () => {
      const result = validateConfig({
        crawler: { respect_robots: 'yes' as unknown as boolean },
      });

      expect(result.valid).toBe(false);
      expect(result.errors[0].path).toBe('crawler.respect_robots');
    });
  });

  describe('project.domains validation', () => {
    it('should pass for valid domains', () => {
      const result = validateConfig({
        project: {
          domains: ['example.com', 'www.example.com'],
        },
      });

      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });

    it('should warn for suspicious domain format', () => {
      const result = validateConfig({
        project: {
          domains: ['http://example.com'], // Should be just domain
        },
      });

      expect(result.valid).toBe(true);
      expect(result.warnings.some(w => w.path.includes('project.domains'))).toBe(true);
    });
  });

  describe('type validation', () => {
    it('should error for non-number where number expected', () => {
      const result = validateConfig({
        crawler: { max_pages: 'hundred' as unknown as number },
      });

      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain('must be a number');
    });

    it('should error for non-string project name', () => {
      const result = validateConfig({
        project: { name: 123 as unknown as string },
      });

      expect(result.valid).toBe(false);
      expect(result.errors[0].path).toBe('project.name');
    });
  });
});

describe('formatValidationResult', () => {
  it('should format valid result', () => {
    const result = {
      valid: true,
      errors: [],
      warnings: [],
    };

    const formatted = formatValidationResult(result);
    expect(formatted).toBe('Configuration is valid.');
  });

  it('should format errors', () => {
    const result = {
      valid: false,
      errors: [
        { path: 'crawler.max_pages', message: 'must be between 1 and 10000', value: 0 },
      ],
      warnings: [],
    };

    const formatted = formatValidationResult(result);
    expect(formatted).toContain('Errors (1)');
    expect(formatted).toContain('crawler.max_pages');
    expect(formatted).toContain('Value: 0');
  });

  it('should format warnings', () => {
    const result = {
      valid: true,
      errors: [],
      warnings: [
        { path: 'crawler.max_pages', message: 'is high', value: 7500 },
      ],
    };

    const formatted = formatValidationResult(result);
    expect(formatted).toContain('Warnings (1)');
    expect(formatted).toContain('crawler.max_pages');
  });

  it('should format both errors and warnings', () => {
    const result = {
      valid: false,
      errors: [
        { path: 'output.format', message: 'invalid format' },
      ],
      warnings: [
        { path: 'crawler.concurrency', message: 'is high' },
      ],
    };

    const formatted = formatValidationResult(result);
    expect(formatted).toContain('Errors (1)');
    expect(formatted).toContain('Warnings (1)');
  });
});
