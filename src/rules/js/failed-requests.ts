import type { AuditContext, FailedRequestInfo } from '../../types.js';
import { defineRule, pass, warn, fail, notMeasured } from '../define-rule.js';

/**
 * Resource types whose failure can change what a crawler indexes.
 *
 * A broken script may never write the content it was responsible for, and a
 * broken stylesheet can leave content visually hidden. A broken tracking pixel
 * or font is a real bug but not an indexing one, so it is reported without
 * being treated as severe.
 */
const INDEXING_CRITICAL_TYPES = new Set(['script', 'stylesheet', 'document', 'fetch', 'xhr']);

/** Group failures by resource type for a readable summary */
function countByType(requests: FailedRequestInfo[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const request of requests) {
    counts[request.resourceType] = (counts[request.resourceType] ?? 0) + 1;
  }
  return counts;
}

/** Compact one failure into a single reportable line */
function describe(request: FailedRequestInfo): string {
  return `${request.resourceType} ${request.failure}: ${request.url}`;
}

/**
 * Rule: Failed Resource Requests
 *
 * Reports subresources that failed to load while the page rendered - both
 * network-level failures (DNS, connection refused) and error statuses on
 * requests that completed.
 *
 * A 404 on a script is invisible to a static HTML audit: the tag is present
 * and well-formed, and only a real fetch reveals that nothing came back.
 */
export const failedRequestsRule = defineRule({
  id: 'js-failed-requests',
  name: 'Failed Resource Requests',
  description:
    'Reports scripts, stylesheets and other subresources that failed to load while rendering',
  category: 'js',
  weight: 8,
  run: (context: AuditContext) => {
    const diagnostics = context.renderDiagnostics;

    if (!diagnostics) {
      return notMeasured(
        'js-failed-requests',
        'Rendered DOM not available - run without --no-cwv to capture failed resource requests'
      );
    }

    const failures = diagnostics.failedRequests;
    const critical = failures.filter((request) =>
      INDEXING_CRITICAL_TYPES.has(request.resourceType)
    );

    const details = {
      failedCount: failures.length,
      indexingCriticalCount: critical.length,
      byResourceType: countByType(failures),
      failures: failures.slice(0, 10).map(describe),
    };

    if (failures.length === 0) {
      return pass('js-failed-requests', 'All page resources loaded successfully', details);
    }

    if (critical.length > 0) {
      return fail(
        'js-failed-requests',
        `${critical.length} script/stylesheet request(s) failed while rendering: ${describe(critical[0])}`,
        {
          ...details,
          impact:
            'A script that never loads cannot render the content it is responsible for, and a missing stylesheet can leave content hidden from a rendering crawler.',
        }
      );
    }

    return warn(
      'js-failed-requests',
      `${failures.length} non-critical resource request(s) failed while rendering: ${describe(failures[0])}`,
      details
    );
  },
});
