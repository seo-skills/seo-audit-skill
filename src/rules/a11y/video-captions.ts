import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, fail } from '../define-rule.js';

interface VideoIssue {
  /** Video identifier */
  video: string;
  /** Issue description */
  issue: string;
  /** Video source if available */
  src?: string;
}

/**
 * Rule: Video Captions
 *
 * Checks that videos have captions or transcripts for deaf/hard of hearing users.
 *
 * Valid caption sources:
 * - <track kind="captions"> element
 * - <track kind="subtitles"> element
 * - Embedded captions in video file
 * - Link to transcript near video
 *
 * This rule checks:
 * - Native HTML5 <video> elements
 * - YouTube/Vimeo embeds (iframe)
 * - Other video embeds
 */
export const videoCaptionsRule = defineRule({
  id: 'a11y-video-captions',
  name: 'Video Captions',
  description: 'Checks that videos have captions or transcripts',
  category: 'a11y',
  weight: 8,
  run: (context: AuditContext) => {
    const { $ } = context;

    const issues: VideoIssue[] = [];
    const validVideos: string[] = [];

    // Check HTML5 video elements
    $('video').each((index, el) => {
      const $video = $(el);
      const videoId = $video.attr('id') || `video-${index + 1}`;
      const src = $video.attr('src') || $video.find('source').first().attr('src') || 'unknown';

      // Check for track elements
      const $tracks = $video.find('track');
      const hasCaptions = $tracks.filter(
        (_, track) =>
          $(track).attr('kind') === 'captions' || $(track).attr('kind') === 'subtitles'
      ).length > 0;

      if (hasCaptions) {
        validVideos.push(videoId);
        return;
      }

      // Check for track with default (might be captions)
      const hasDefaultTrack = $tracks.length > 0;
      if (hasDefaultTrack) {
        validVideos.push(videoId);
        return;
      }

      // Check for nearby transcript link
      const $parent = $video.parent();
      const nearbyTranscript =
        $parent.find('a[href*="transcript"]').length > 0 ||
        $parent.text().toLowerCase().includes('transcript');

      if (nearbyTranscript) {
        validVideos.push(videoId);
        return;
      }

      issues.push({
        video: videoId,
        issue: 'No captions track or transcript found',
        src: src.slice(0, 50),
      });
    });

    // Check iframe video embeds (YouTube, Vimeo, etc.)
    $('iframe').each((index, el) => {
      const $iframe = $(el);
      const src = $iframe.attr('src') || '';

      // Check if this is a video embed
      const isYouTube = /youtube\.com|youtu\.be/i.test(src);
      const isVimeo = /vimeo\.com/i.test(src);
      const isVideo = isYouTube || isVimeo || /video|player/i.test(src);

      if (!isVideo) {
        return;
      }

      const videoId = $iframe.attr('id') || $iframe.attr('title') || `embed-${index + 1}`;

      // YouTube: check for cc_load_policy parameter
      if (isYouTube) {
        if (src.includes('cc_load_policy=1')) {
          validVideos.push(`YouTube: ${videoId}`);
          return;
        }

        // Check for nearby transcript
        const $parent = $iframe.parent();
        if (
          $parent.find('a[href*="transcript"]').length > 0 ||
          $parent.text().toLowerCase().includes('transcript')
        ) {
          validVideos.push(`YouTube: ${videoId}`);
          return;
        }

        issues.push({
          video: `YouTube: ${videoId}`,
          issue: 'YouTube embed without cc_load_policy=1 parameter',
          src: src.slice(0, 60),
        });
        return;
      }

      // Vimeo: check for texttrack parameter
      if (isVimeo) {
        if (src.includes('texttrack=')) {
          validVideos.push(`Vimeo: ${videoId}`);
          return;
        }

        issues.push({
          video: `Vimeo: ${videoId}`,
          issue: 'Vimeo embed - verify captions are enabled in video settings',
          src: src.slice(0, 60),
        });
        return;
      }

      // Other video embeds
      issues.push({
        video: videoId,
        issue: 'Video embed without detectable captions',
        src: src.slice(0, 60),
      });
    });

    // Check for audio elements (transcripts needed)
    $('audio').each((index, el) => {
      const $audio = $(el);
      const audioId = $audio.attr('id') || `audio-${index + 1}`;

      // Check for nearby transcript
      const $parent = $audio.parent();
      const hasTranscript =
        $parent.find('a[href*="transcript"]').length > 0 ||
        $parent.text().toLowerCase().includes('transcript');

      if (!hasTranscript) {
        issues.push({
          video: `Audio: ${audioId}`,
          issue: 'Audio element without transcript link',
        });
      }
    });

    const totalMedia = issues.length + validVideos.length;

    if (totalMedia === 0) {
      return pass('a11y-video-captions', 'No video or audio elements found on page', {
        note: 'If adding video content, include captions or transcripts',
      });
    }

    if (issues.length === 0) {
      return pass('a11y-video-captions', 'All video/audio elements have captions or transcripts', {
        mediaWithCaptions: validVideos.length,
      });
    }

    // Fail if majority of videos lack captions
    if (issues.length > validVideos.length) {
      return fail(
        'a11y-video-captions',
        `${issues.length} video/audio element(s) missing captions`,
        {
          issues: issues.slice(0, 10),
          totalMedia,
          validMedia: validVideos.length,
        }
      );
    }

    return warn(
      'a11y-video-captions',
      `${issues.length} video/audio element(s) may need captions`,
      {
        issues,
        totalMedia,
        validMedia: validVideos.length,
      }
    );
  },
});
