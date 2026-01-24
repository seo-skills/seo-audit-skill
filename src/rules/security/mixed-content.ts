import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, fail } from '../define-rule.js';

type MixedContentType = 'script' | 'stylesheet' | 'image' | 'iframe' | 'audio' | 'video' | 'object' | 'embed';

interface MixedContentItem {
  /** Resource type */
  type: MixedContentType;
  /** HTTP URL */
  url: string;
}

// Active mixed content types that browsers block
const ACTIVE_TYPES: MixedContentType[] = ['script', 'stylesheet', 'iframe', 'object', 'embed'];

/**
 * Rule: Mixed Content
 *
 * Detects HTTP resources loaded on HTTPS pages.
 * Active mixed content (scripts, styles) is blocked by browsers.
 * Passive mixed content (images) may show warnings.
 */
export const mixedContentRule = defineRule({
  id: 'security-mixed-content',
  name: 'Mixed Content',
  description: 'Checks for HTTP resources on HTTPS pages',
  category: 'security',
  weight: 8,
  run: (context: AuditContext) => {
    const { $, url } = context;

    // Only relevant for HTTPS pages
    if (!url.startsWith('https://')) {
      return pass('security-mixed-content', 'Page is not HTTPS, mixed content check not applicable', {
        isHttps: false,
      });
    }

    const mixedContent: MixedContentItem[] = [];

    // Check scripts (active mixed content - blocked by browsers)
    $('script[src^="http://"]').each((_, el) => {
      const src = $(el).attr('src');
      if (src) mixedContent.push({ type: 'script', url: src });
    });

    // Check stylesheets (active mixed content)
    $('link[rel="stylesheet"][href^="http://"]').each((_, el) => {
      const href = $(el).attr('href');
      if (href) mixedContent.push({ type: 'stylesheet', url: href });
    });

    // Check images (passive mixed content - may show warning)
    $('img[src^="http://"]').each((_, el) => {
      const src = $(el).attr('src');
      if (src) mixedContent.push({ type: 'image', url: src });
    });

    // Check iframes (active mixed content)
    $('iframe[src^="http://"]').each((_, el) => {
      const src = $(el).attr('src');
      if (src) mixedContent.push({ type: 'iframe', url: src });
    });

    // Check audio (passive mixed content)
    $('audio[src^="http://"]').each((_, el) => {
      const src = $(el).attr('src');
      if (src) mixedContent.push({ type: 'audio', url: src });
    });
    $('audio source[src^="http://"]').each((_, el) => {
      const src = $(el).attr('src');
      if (src) mixedContent.push({ type: 'audio', url: src });
    });

    // Check video (passive mixed content)
    $('video[src^="http://"]').each((_, el) => {
      const src = $(el).attr('src');
      if (src) mixedContent.push({ type: 'video', url: src });
    });
    $('video source[src^="http://"]').each((_, el) => {
      const src = $(el).attr('src');
      if (src) mixedContent.push({ type: 'video', url: src });
    });

    // Check object (active mixed content)
    $('object[data^="http://"]').each((_, el) => {
      const data = $(el).attr('data');
      if (data) mixedContent.push({ type: 'object', url: data });
    });

    // Check embed (active mixed content)
    $('embed[src^="http://"]').each((_, el) => {
      const src = $(el).attr('src');
      if (src) mixedContent.push({ type: 'embed', url: src });
    });

    if (mixedContent.length === 0) {
      return pass('security-mixed-content', 'No mixed content detected', { isHttps: true });
    }

    // Check if any active mixed content exists
    const hasActiveMixed = mixedContent.some(item => ACTIVE_TYPES.includes(item.type));

    // Group by type for summary
    const byType = mixedContent.reduce((acc, item) => {
      acc[item.type] = (acc[item.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const message = `Found ${mixedContent.length} HTTP resource(s) on HTTPS page`;
    const details = {
      mixedContent: mixedContent.slice(0, 20),
      totalMixed: mixedContent.length,
      byType,
      hasActiveMixed,
    };

    // Active mixed content is a security failure
    return hasActiveMixed
      ? fail('security-mixed-content', message, details)
      : warn('security-mixed-content', message, details);
  },
});
