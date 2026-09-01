import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, notMeasured } from '../define-rule.js';

// Reference hint: redirects/redirected-page-resource-urls

/** Maximum number of chained resources listed in the result details */
const MAX_LISTED = 20;

/**
 * Rule: Resource Redirect Chain Detection
 *
 * Checks that page resources do not resolve through multi-hop redirect chains.
 * A single hop is usually benign (http to https, trailing-slash
 * normalisation), but every extra hop adds latency to page load and wastes
 * crawl budget. Resources caught in a redirect loop are excluded here — they
 * are already failed by `redirect-resource-loop`, and a loop's chain length
 * says nothing about how the resource should be fixed.
 */
export const resourceChainRedirectRule = defineRule({
  id: 'redirect-resource-chain',
  name: 'No Resource Redirect Chains',
  description: 'Checks that page resources do not resolve through multi-hop redirect chains',
  category: 'redirect',
  weight: 8,
  run: (context: AuditContext) => {
    const assets = context.assets;

    if (!assets) {
      return notMeasured(
        'redirect-resource-chain',
        'Rendered page assets not captured - run without --no-cwv to measure resource redirects'
      );
    }

    const singleHopCount = assets.filter((asset) => asset.redirectChain.length === 1).length;
    const chained = assets.filter((asset) => !asset.redirectLoop && asset.redirectChain.length >= 2);

    if (chained.length === 0) {
      return pass('redirect-resource-chain', 'No multi-hop resource redirect chains detected', {
        assetsChecked: assets.length,
        singleHopRedirects: singleHopCount,
      });
    }

    return warn(
      'redirect-resource-chain',
      `${chained.length} page resource(s) resolve through redirect chains of 2 or more hops`,
      {
        chainedCount: chained.length,
        assetsChecked: assets.length,
        singleHopRedirects: singleHopCount,
        resources: chained.slice(0, MAX_LISTED).map((asset) => ({
          url: asset.url,
          resourceType: asset.resourceType,
          chainLength: asset.redirectChain.length,
          finalStatusCode: asset.statusCode,
        })),
        recommendation: 'Update the resource URLs to point directly at the final destination',
      }
    );
  },
});
