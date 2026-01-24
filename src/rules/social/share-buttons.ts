import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn } from '../define-rule.js';

/**
 * Common social sharing URL patterns and selectors
 */
const SHARE_PATTERNS = [
  // URL-based sharing links
  { platform: 'Facebook', pattern: /facebook\.com\/share/i },
  { platform: 'Facebook', pattern: /facebook\.com\/sharer/i },
  { platform: 'Twitter/X', pattern: /twitter\.com\/intent\/tweet/i },
  { platform: 'Twitter/X', pattern: /twitter\.com\/share/i },
  { platform: 'Twitter/X', pattern: /x\.com\/intent\/tweet/i },
  { platform: 'LinkedIn', pattern: /linkedin\.com\/share/i },
  { platform: 'LinkedIn', pattern: /linkedin\.com\/shareArticle/i },
  { platform: 'Pinterest', pattern: /pinterest\.com\/pin\/create/i },
  { platform: 'Reddit', pattern: /reddit\.com\/submit/i },
  { platform: 'WhatsApp', pattern: /wa\.me\//i },
  { platform: 'WhatsApp', pattern: /whatsapp\.com\/send/i },
  { platform: 'WhatsApp', pattern: /api\.whatsapp\.com\/send/i },
  { platform: 'Telegram', pattern: /t\.me\/share/i },
  { platform: 'Telegram', pattern: /telegram\.me\/share/i },
  { platform: 'Email', pattern: /mailto:\?.*subject=/i },
];

/**
 * Common class/id patterns for share buttons
 */
const SHARE_SELECTORS = [
  // Common share button classes
  '[class*="share"]',
  '[class*="social-share"]',
  '[class*="sharing"]',
  '[id*="share"]',
  // Common widget classes
  '.addthis_toolbox',
  '.addtoany_share',
  '.sharethis-inline',
  '[class*="sharethis"]',
  '[class*="addtoany"]',
  // Aria labels
  '[aria-label*="share"]',
  '[aria-label*="Share"]',
  // Data attributes
  '[data-share]',
  '[data-social-share]',
];

/**
 * Rule: Check for social sharing buttons on content pages
 *
 * Detects common social sharing mechanisms including:
 * - Direct share URLs (Facebook, Twitter, LinkedIn, etc.)
 * - Share button widgets (AddThis, ShareThis, AddToAny)
 * - Custom share button patterns
 */
export const shareButtonsRule = defineRule({
  id: 'social-share-buttons',
  name: 'Social Share Buttons',
  description:
    'Checks for social sharing buttons on content pages to encourage social engagement',
  category: 'social',
  weight: 1,
  run: async (context: AuditContext) => {
    const { $ } = context;

    const detectedPlatforms = new Set<string>();
    const shareLinks: string[] = [];

    // Check all links for share URL patterns
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href') || '';
      for (const { platform, pattern } of SHARE_PATTERNS) {
        if (pattern.test(href)) {
          detectedPlatforms.add(platform);
          if (shareLinks.length < 10) {
            shareLinks.push(href);
          }
          break;
        }
      }
    });

    // Check for share button containers using selectors
    let hasShareContainer = false;
    for (const selector of SHARE_SELECTORS) {
      try {
        if ($(selector).length > 0) {
          hasShareContainer = true;
          break;
        }
      } catch {
        // Invalid selector, skip
      }
    }

    // Check for common share button scripts
    const hasShareScript = $('script[src]').toArray().some((el) => {
      const src = $(el).attr('src') || '';
      return /addthis|sharethis|addtoany|socialshare/i.test(src);
    });

    const platformCount = detectedPlatforms.size;
    const platforms = Array.from(detectedPlatforms);

    // Has explicit share links
    if (platformCount >= 2) {
      return pass(
        'social-share-buttons',
        `Found share buttons for ${platformCount} platforms: ${platforms.join(', ')}`,
        {
          hasShareButtons: true,
          platformCount,
          platforms,
          shareLinks: shareLinks.slice(0, 5),
        }
      );
    }

    // Has share container or script but no detected links
    if (hasShareContainer || hasShareScript) {
      return pass(
        'social-share-buttons',
        'Social sharing widget detected',
        {
          hasShareButtons: true,
          hasShareContainer,
          hasShareScript,
          platforms,
        }
      );
    }

    // Only one platform detected
    if (platformCount === 1) {
      return warn(
        'social-share-buttons',
        `Only found share button for ${platforms[0]}. Consider adding more platforms (Facebook, Twitter/X, LinkedIn)`,
        {
          hasShareButtons: true,
          platformCount,
          platforms,
          limitedPlatforms: true,
        }
      );
    }

    // No share buttons found
    return warn(
      'social-share-buttons',
      'No social sharing buttons detected. Add share buttons to encourage social engagement',
      {
        hasShareButtons: false,
        platformCount: 0,
        suggestion: 'Add share buttons for Facebook, Twitter/X, and LinkedIn',
      }
    );
  },
});
