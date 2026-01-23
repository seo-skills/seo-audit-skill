import { describe, it, expect } from 'vitest';
import { getDefaultConfig } from './defaults.js';

describe('getDefaultConfig', () => {
  it('should return complete default config', () => {
    const config = getDefaultConfig();

    expect(config.project.name).toBe('');
    expect(config.project.domains).toEqual([]);
    expect(config.crawler.max_pages).toBe(100);
    expect(config.crawler.concurrency).toBe(3);
    expect(config.rules.enable).toEqual(['*']);
    expect(config.rules.disable).toEqual([]);
    expect(config.external_links.enabled).toBe(true);
    expect(config.output.format).toBe('console');
  });

  it('should return a new object each time', () => {
    const config1 = getDefaultConfig();
    const config2 = getDefaultConfig();
    expect(config1).not.toBe(config2);
  });
});
