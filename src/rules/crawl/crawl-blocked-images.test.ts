import { describe, it, expect } from 'vitest';
import * as cheerio from 'cheerio';
import type { AuditContext, ImageInfo } from '../../types.js';
import { blockedImagesRule } from './blocked-images.js';

const ROBOTS_BLOCKING_IMAGES = 'User-agent: *\nDisallow: /images/';
const ROBOTS_ALLOW_ALL = 'User-agent: *\nAllow: /';

/**
 * Helper to create an audit context with images and robots.txt content
 */
function createContext(
  images: ImageInfo[] = [],
  robotsTxtContent?: string
): AuditContext {
  const html = '<html><body></body></html>';
  return {
    url: 'https://example.com/page',
    html,
    $: cheerio.load(html),
    headers: {},
    statusCode: 200,
    responseTime: 100,
    cwv: {},
    links: [],
    images,
    invalidLinks: [],
    specialLinks: [],
    figures: [],
    inlineSvgs: [],
    pictureElements: [],
    robotsTxtContent,
  } as AuditContext;
}

function image(src: string): ImageInfo {
  return { src, alt: '', hasAlt: false, isLazyLoaded: false };
}

describe('crawl-blocked-images', () => {
  it('should return notMeasured when robots.txt content is absent', async () => {
    const result = await blockedImagesRule.run(
      createContext([image('/images/hero.jpg')])
    );
    expect(result.status).toBe('warn');
    expect(result.weight).toBe(0);
  });

  it('should fail when an image URL is disallowed by robots.txt', async () => {
    const result = await blockedImagesRule.run(
      createContext(
        [image('https://example.com/images/hero.jpg'), image('/logo.png')],
        ROBOTS_BLOCKING_IMAGES
      )
    );
    expect(result.status).toBe('fail');
    expect(result.score).toBe(0);
    expect(result.details?.blockedCount).toBe(1);
    expect(result.details?.blockedImages).toEqual([
      'https://example.com/images/hero.jpg',
    ]);
  });

  it('should resolve relative image srcs against the page URL', async () => {
    const result = await blockedImagesRule.run(
      createContext([image('/images/hero.jpg')], ROBOTS_BLOCKING_IMAGES)
    );
    expect(result.status).toBe('fail');
    expect(result.details?.blockedImages).toEqual([
      'https://example.com/images/hero.jpg',
    ]);
  });

  it('should pass when no images are disallowed', async () => {
    const result = await blockedImagesRule.run(
      createContext(
        [image('/images/hero.jpg'), image('/logo.png')],
        ROBOTS_ALLOW_ALL
      )
    );
    expect(result.status).toBe('pass');
    expect(result.details?.blockedCount).toBe(0);
    expect(result.details?.imageCount).toBe(2);
  });

  it('should honor a more specific Allow rule over a Disallow', async () => {
    const robots = 'User-agent: *\nDisallow: /images/\nAllow: /images/public/';
    const result = await blockedImagesRule.run(
      createContext(
        [image('/images/public/hero.jpg'), image('/images/private/hero.jpg')],
        robots
      )
    );
    expect(result.status).toBe('fail');
    expect(result.details?.blockedImages).toEqual([
      'https://example.com/images/private/hero.jpg',
    ]);
  });

  it('should skip cross-origin images governed by another host\'s robots.txt', async () => {
    const result = await blockedImagesRule.run(
      createContext(
        [image('https://cdn.example.net/images/hero.jpg')],
        ROBOTS_BLOCKING_IMAGES
      )
    );
    expect(result.status).toBe('pass');
    expect(result.details?.imageCount).toBe(0);
  });

  it('should pass when the page has no images', async () => {
    const result = await blockedImagesRule.run(
      createContext([], ROBOTS_BLOCKING_IMAGES)
    );
    expect(result.status).toBe('pass');
    expect(result.details?.imageCount).toBe(0);
  });
});
