import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn } from '../define-rule.js';

/**
 * Known tracking parameter names that should not appear in indexed URLs.
 * These create duplicate content if not handled with canonical tags.
 */
const TRACKING_PARAMS = new Set([
  // Google Analytics / Ads
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'utm_id',

  // Google Ads
  'gclid',
  'gclsrc',
  'dclid',
  'wbraid',
  'gbraid',

  // Facebook / Meta
  'fbclid',
  'fb_action_ids',
  'fb_action_types',
  'fb_source',

  // Microsoft Ads
  'msclkid',

  // Mailchimp
  'mc_cid',
  'mc_eid',

  // HubSpot
  '_hsenc',
  '_hsmi',
  '__hstc',
  '__hsfp',
  'hsCtaTracking',

  // Other common trackers
  'ref',
  'affiliate_id',
  'zanpid',
  'spm',
]);

/**
 * Rule: Check for tracking parameters in URL
 *
 * Tracking parameters create numerous URL variations pointing to the same
 * content. Without proper canonical tags, they fragment link equity and
 * waste crawl budget.
 */
export const trackingParamsRule = defineRule({
  id: 'url-tracking-params',
  name: 'Tracking Parameters in URL',
  description:
    'Checks for common tracking parameters (UTM, gclid, fbclid, etc.) that create duplicate URL variations',
  category: 'url',
  weight: 5,
  run: async (context: AuditContext) => {
    const { url } = context;

    try {
      const urlObj = new URL(url);
      const params = urlObj.searchParams;
      const foundTrackers: string[] = [];

      for (const key of params.keys()) {
        const lowerKey = key.toLowerCase();
        if (TRACKING_PARAMS.has(lowerKey)) {
          foundTrackers.push(key);
        }
      }

      if (foundTrackers.length === 0) {
        return pass(
          'url-tracking-params',
          'No tracking parameters found in URL',
          { url }
        );
      }

      return warn(
        'url-tracking-params',
        `URL contains ${foundTrackers.length} tracking parameter(s): ${foundTrackers.join(', ')}`,
        {
          url,
          trackingParameters: foundTrackers,
          trackingParameterCount: foundTrackers.length,
          fix: 'Use canonical tags to point to the clean URL without tracking parameters',
        }
      );
    } catch {
      return pass('url-tracking-params', 'Could not parse URL', { url });
    }
  },
});
