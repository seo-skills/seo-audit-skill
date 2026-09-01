import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, notMeasured } from '../define-rule.js';

// Reference hint: internal/url-contains-more-than-one-google-tag-manager-code

/**
 * Matches a Google Tag Manager container ID (e.g. GTM-ABC123)
 */
const GTM_ID_PATTERN = /\bGTM-[A-Z0-9]+\b/g;

/**
 * Collects the distinct GTM container IDs referenced by script tags,
 * from both src attributes and inline snippets
 */
function collectGtmContainerIds($: AuditContext['$']): string[] {
  const ids = new Set<string>();

  $('script').each((_, script) => {
    const src = $(script).attr('src') ?? '';
    const inline = $(script).html() ?? '';

    for (const text of [src, inline]) {
      const matches = text.match(GTM_ID_PATTERN);
      if (matches) {
        for (const id of matches) {
          ids.add(id);
        }
      }
    }
  });

  return [...ids].sort();
}

/**
 * Rule: Detect multiple Google Tag Manager containers on one page
 *
 * More than one distinct GTM container embedded in the page is supported
 * by Google but not recommended — it often signals a configuration error
 * (e.g. a plugin adding a second snippet) and hurts performance.
 */
export const duplicateGtmRule = defineRule({
  id: 'technical-duplicate-gtm',
  name: 'Multiple Google Tag Manager Containers',
  description:
    'Detects pages embedding more than one distinct Google Tag Manager container ID',
  category: 'technical',
  weight: 1,
  run: async (context: AuditContext) => {
    const { $ } = context;

    if (!$) {
      return notMeasured(
        'technical-duplicate-gtm',
        'Page HTML was not collected; cannot scan for Tag Manager containers'
      );
    }

    const containerIds = collectGtmContainerIds($);

    if (containerIds.length > 1) {
      return warn(
        'technical-duplicate-gtm',
        `Page contains ${containerIds.length} distinct Google Tag Manager containers: ${containerIds.join(', ')}`,
        {
          containerIds,
          fix: 'Verify all containers are intentional; consolidate into a single container where possible',
        }
      );
    }

    return pass(
      'technical-duplicate-gtm',
      containerIds.length === 1
        ? `Page contains a single Google Tag Manager container: ${containerIds[0]}`
        : 'No Google Tag Manager containers found',
      { containerIds }
    );
  },
});
