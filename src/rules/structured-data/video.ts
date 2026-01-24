import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, fail } from '../define-rule.js';
import { findItemsByType, getMissingFields, hasField } from './utils.js';

const REQUIRED = ['name', 'thumbnailUrl', 'uploadDate'];
const RECOMMENDED = ['description', 'contentUrl', 'duration', 'embedUrl', 'interactionStatistic'];

/**
 * Rule: Video Schema
 *
 * Validates VideoObject schema for video rich results in search.
 */
export const structuredDataVideoRule = defineRule({
  id: 'structured-data-video',
  name: 'Video Schema',
  description: 'Validates VideoObject schema for video rich results',
  category: 'structured-data',
  weight: 10,
  run: (context: AuditContext) => {
    const { $ } = context;
    const videos = findItemsByType($, 'VideoObject');

    if (videos.length === 0) {
      return pass('structured-data-video', 'No VideoObject schema found (not required)', {
        found: false,
      });
    }

    const issues: string[] = [];
    const warnings: string[] = [];

    for (const video of videos) {
      const missing = getMissingFields(video, REQUIRED);
      if (missing.length > 0) {
        issues.push(`VideoObject missing: ${missing.join(', ')}`);
      }

      // Validate thumbnailUrl is absolute
      if (hasField(video, 'thumbnailUrl')) {
        const thumb = video.data.thumbnailUrl;
        if (typeof thumb === 'string' && !thumb.startsWith('http')) {
          warnings.push('thumbnailUrl should be absolute URL');
        }
      }

      // Check duration format (ISO 8601)
      if (hasField(video, 'duration')) {
        const dur = video.data.duration;
        if (typeof dur === 'string' && !dur.startsWith('PT')) {
          warnings.push('duration should be ISO 8601 format (e.g., PT1M30S)');
        }
      }

      // Check uploadDate format
      if (hasField(video, 'uploadDate')) {
        const date = video.data.uploadDate;
        if (typeof date === 'string' && !/^\d{4}-\d{2}-\d{2}/.test(date)) {
          warnings.push('uploadDate should be ISO 8601 date format');
        }
      }

      const missingRecommended = getMissingFields(video, RECOMMENDED);
      if (missingRecommended.length > 0) {
        warnings.push(`consider adding ${missingRecommended.join(', ')}`);
      }
    }

    if (issues.length > 0) {
      return fail('structured-data-video', issues.join('; '), {
        videoCount: videos.length,
        issues,
        warnings,
      });
    }

    if (warnings.length > 0) {
      return warn('structured-data-video', 'VideoObject valid with suggestions', {
        videoCount: videos.length,
        warnings,
      });
    }

    return pass('structured-data-video', `${videos.length} VideoObject schema(s) properly configured`, {
      videoCount: videos.length,
    });
  },
});
