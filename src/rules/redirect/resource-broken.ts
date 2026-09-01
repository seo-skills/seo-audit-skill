import type { AuditContext } from '../../types.js';
import { defineRule, pass, fail, notMeasured } from '../define-rule.js';

// Reference hint: redirects/external-url-redirect-broken-4xx-or-5xx
// Reference hint: redirects/resource-url-redirect-broken-4xx-or-5xx

/** Maximum number of broken resources listed in the result details */
const MAX_LISTED = 20;

/**
 * Rule: Broken Resource Redirect Detection
 *
 * Checks that page resources (scripts, stylesheets, images, fonts) whose
 * requests were redirected do not end in a 4xx or 5xx response. A redirected
 * resource that resolves to an error status wastes crawl budget on the hops
 * and still leaves the page without the resource. Resources that fail without
 * any redirect are out of scope here — they are reported by
 * `js-failed-requests` instead.
 */
export const resourceBrokenRedirectRule = defineRule({
  id: 'redirect-resource-broken',
  name: 'No Broken Resource Redirects',
  description: 'Checks that redirected page resources do not resolve to a 4xx or 5xx status',
  category: 'redirect',
  weight: 12,
  run: (context: AuditContext) => {
    const assets = context.assets;

    if (!assets) {
      return notMeasured(
        'redirect-resource-broken',
        'Rendered page assets not captured - run without --no-cwv to measure resource redirects'
      );
    }

    const redirected = assets.filter((asset) => asset.redirectChain.length > 0);
    const broken = redirected.filter((asset) => asset.statusCode >= 400);

    if (broken.length === 0) {
      return pass('redirect-resource-broken', 'No redirected resources resolve to a broken (4xx/5xx) response', {
        assetsChecked: assets.length,
        redirectedCount: redirected.length,
      });
    }

    return fail(
      'redirect-resource-broken',
      `${broken.length} redirected resource(s) resolve to a 4xx/5xx status; the redirect destination is broken`,
      {
        brokenCount: broken.length,
        assetsChecked: assets.length,
        resources: broken.slice(0, MAX_LISTED).map((asset) => ({
          url: asset.url,
          resourceType: asset.resourceType,
          finalStatusCode: asset.statusCode,
          chainLength: asset.redirectChain.length,
        })),
        recommendation: 'Update the resource URLs to point directly at a working destination',
      }
    );
  },
});
