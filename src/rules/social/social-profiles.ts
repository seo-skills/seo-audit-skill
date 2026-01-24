import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn } from '../define-rule.js';

/**
 * Social media profile URL patterns
 */
const SOCIAL_PROFILE_PATTERNS = [
  { platform: 'Facebook', pattern: /^https?:\/\/(www\.)?facebook\.com\/(?!sharer|share)[\w.-]+\/?$/i },
  { platform: 'Twitter/X', pattern: /^https?:\/\/(www\.)?(twitter|x)\.com\/(?!intent|share)[\w]+\/?$/i },
  { platform: 'Instagram', pattern: /^https?:\/\/(www\.)?instagram\.com\/[\w.]+\/?$/i },
  { platform: 'LinkedIn', pattern: /^https?:\/\/(www\.)?linkedin\.com\/(company|in)\/[\w-]+\/?$/i },
  { platform: 'YouTube', pattern: /^https?:\/\/(www\.)?youtube\.com\/(@[\w]+|channel\/[\w-]+|c\/[\w-]+|user\/[\w-]+)\/?$/i },
  { platform: 'TikTok', pattern: /^https?:\/\/(www\.)?tiktok\.com\/@[\w.]+\/?$/i },
  { platform: 'Pinterest', pattern: /^https?:\/\/(www\.)?pinterest\.com\/[\w]+\/?$/i },
  { platform: 'GitHub', pattern: /^https?:\/\/(www\.)?github\.com\/[\w-]+\/?$/i },
  { platform: 'Threads', pattern: /^https?:\/\/(www\.)?threads\.net\/@[\w.]+\/?$/i },
  { platform: 'Bluesky', pattern: /^https?:\/\/bsky\.app\/profile\/[\w.-]+\/?$/i },
  { platform: 'Mastodon', pattern: /^https?:\/\/[\w.-]+\/@[\w]+\/?$/i },
];

/**
 * Check if link is likely a profile link (not a share/action link)
 */
function isProfileLink(href: string): { isProfile: boolean; platform?: string } {
  for (const { platform, pattern } of SOCIAL_PROFILE_PATTERNS) {
    if (pattern.test(href)) {
      return { isProfile: true, platform };
    }
  }
  return { isProfile: false };
}

/**
 * Rule: Check for links to social media profiles
 *
 * Social profile links help establish brand presence and provide
 * users with ways to connect on social platforms.
 * Also validates sameAs structured data for social profiles.
 */
export const socialProfilesRule = defineRule({
  id: 'social-profiles',
  name: 'Social Profile Links',
  description:
    'Checks for links to social media profiles in header, footer, or structured data',
  category: 'social',
  weight: 1,
  run: async (context: AuditContext) => {
    const { $ } = context;

    const detectedProfiles: { platform: string; url: string }[] = [];
    const platforms = new Set<string>();

    // Check links in header/footer (common locations for social links)
    const socialLinkContainers = [
      'header',
      'footer',
      'nav',
      '[class*="social"]',
      '[class*="follow"]',
      '[id*="social"]',
      '[aria-label*="social"]',
    ];

    // Check structured data for sameAs (Organization/Person schema)
    const scripts = $('script[type="application/ld+json"]');
    scripts.each((_, el) => {
      try {
        const content = $(el).html();
        if (!content) return;

        const data = JSON.parse(content);
        const items = Array.isArray(data) ? data : [data];

        for (const item of items) {
          // Check sameAs property
          const sameAs = item.sameAs || item['sameAs'];
          if (sameAs) {
            const urls = Array.isArray(sameAs) ? sameAs : [sameAs];
            for (const url of urls) {
              if (typeof url === 'string') {
                const { isProfile, platform } = isProfileLink(url);
                if (isProfile && platform && !platforms.has(platform)) {
                  platforms.add(platform);
                  detectedProfiles.push({ platform, url });
                }
              }
            }
          }
        }
      } catch {
        // Invalid JSON-LD, ignore
      }
    });

    // Check HTML links in social containers
    for (const container of socialLinkContainers) {
      try {
        $(`${container} a[href]`).each((_, el) => {
          const href = $(el).attr('href') || '';
          const { isProfile, platform } = isProfileLink(href);
          if (isProfile && platform && !platforms.has(platform)) {
            platforms.add(platform);
            detectedProfiles.push({ platform, url: href });
          }
        });
      } catch {
        // Invalid selector, skip
      }
    }

    // Also check all links as fallback
    if (detectedProfiles.length === 0) {
      $('a[href]').each((_, el) => {
        const href = $(el).attr('href') || '';
        const { isProfile, platform } = isProfileLink(href);
        if (isProfile && platform && !platforms.has(platform)) {
          platforms.add(platform);
          detectedProfiles.push({ platform, url: href });
        }
      });
    }

    const profileCount = detectedProfiles.length;
    const platformList = detectedProfiles.map((p) => p.platform);

    // Good: Multiple social profiles found
    if (profileCount >= 3) {
      return pass(
        'social-profiles',
        `Found links to ${profileCount} social profiles: ${platformList.join(', ')}`,
        {
          hasProfiles: true,
          profileCount,
          profiles: detectedProfiles.slice(0, 10),
        }
      );
    }

    // Some profiles found
    if (profileCount > 0) {
      return warn(
        'social-profiles',
        `Only ${profileCount} social profile${profileCount === 1 ? '' : 's'} found (${platformList.join(', ')}). Consider adding more for brand presence`,
        {
          hasProfiles: true,
          profileCount,
          profiles: detectedProfiles,
          suggestion: 'Add links to major platforms like Facebook, Twitter/X, Instagram, or LinkedIn',
        }
      );
    }

    // No profiles found
    return warn(
      'social-profiles',
      'No social media profile links found. Add links to your social profiles in header/footer',
      {
        hasProfiles: false,
        profileCount: 0,
        suggestion: 'Add social profile links in header/footer and include sameAs in Organization schema',
      }
    );
  },
});
