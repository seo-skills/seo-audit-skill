import type { AuditContext } from '../../types.js';
import { defineRule, pass, fail, notMeasured } from '../define-rule.js';

// Reference hint: redirects/page-resource-url-redirects-back-to-itself
// Reference hint: redirects/page-resource-url-is-part-of-a-chained-redirect-loop

/** Maximum number of looping resources listed in the result details */
const MAX_LISTED = 20;

/**
 * Rule: Resource Redirect Loop Detection
 *
 * Checks that no page resource request loops back to a URL already present in
 * its own redirect chain. A looping resource never resolves — the browser
 * aborts with ERR_TOO_MANY_REDIRECTS — so the page loads without that script,
 * stylesheet, or image.
 */
export const resourceLoopRedirectRule = defineRule({
  id: 'redirect-resource-loop',
  name: 'No Resource Redirect Loops',
  description: 'Checks that page resources are not caught in redirect loops',
  category: 'redirect',
  weight: 12,
  run: (context: AuditContext) => {
    const assets = context.assets;

    if (!assets) {
      return notMeasured(
        'redirect-resource-loop',
        'Rendered page assets not captured - run without --no-cwv to measure resource redirects'
      );
    }

    const looping = assets.filter((asset) => asset.redirectLoop);

    if (looping.length === 0) {
      return pass('redirect-resource-loop', 'No resource redirect loops detected', {
        assetsChecked: assets.length,
      });
    }

    return fail(
      'redirect-resource-loop',
      `${looping.length} page resource(s) are caught in a redirect loop and never resolve`,
      {
        loopCount: looping.length,
        assetsChecked: assets.length,
        resources: looping.slice(0, MAX_LISTED).map((asset) => ({
          url: asset.url,
          resourceType: asset.resourceType,
          chainLength: asset.redirectChain.length,
        })),
        recommendation: 'Fix the redirect target so the chain resolves to a final resource instead of looping',
      }
    );
  },
});
