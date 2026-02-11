import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn } from '../define-rule.js';

/**
 * Rule: llms.txt Reference
 *
 * Checks whether the page references an llms.txt file. The llms.txt
 * standard (llmstxt.org) is an emerging convention that provides
 * machine-readable context about a site specifically for large language
 * models - describing what the site does, how to cite it, and which
 * pages are most useful for AI consumption.
 *
 * This rule inspects the page HTML for:
 * - <link rel="llms" href="..."> tag
 * - <meta name="llms" content="..."> tag
 * - Any anchor link pointing to /llms.txt or /.well-known/llms.txt
 *
 * Note: This is informational. llms.txt is an emerging standard and is
 * not yet required for good GEO.
 *
 * Scoring:
 * - llms.txt reference found: pass
 * - No reference found: warn (informational)
 */
export const llmsTxtRule = defineRule({
  id: 'geo-llms-txt',
  name: 'llms.txt Reference',
  description:
    'Checks if the page references an llms.txt file for AI discoverability (emerging standard)',
  category: 'geo',
  weight: 15,
  run: (context: AuditContext) => {
    const { $ } = context;

    const references: string[] = [];

    // Check for <link rel="llms" href="...">
    const llmsLink = $('link[rel="llms"]');
    if (llmsLink.length > 0) {
      const href = llmsLink.first().attr('href');
      if (href) {
        references.push(`<link rel="llms" href="${href}">`);
      }
    }

    // Check for <meta name="llms" content="...">
    const llmsMeta = $('meta[name="llms"]');
    if (llmsMeta.length > 0) {
      const content = llmsMeta.first().attr('content');
      if (content) {
        references.push(`<meta name="llms" content="${content}">`);
      }
    }

    // Check for anchor links pointing to llms.txt paths
    const llmsPaths = ['/llms.txt', '/.well-known/llms.txt'];
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href') || '';
      for (const path of llmsPaths) {
        if (href === path || href.endsWith(path)) {
          references.push(`<a href="${href}"> link to ${path}`);
          return false; // break each loop for this element
        }
      }
    });

    // Also check <link> tags with href containing llms.txt
    $('link[href]').each((_, el) => {
      const href = $(el).attr('href') || '';
      const rel = $(el).attr('rel') || '';
      // Skip the rel="llms" we already checked
      if (rel === 'llms') return;
      for (const path of llmsPaths) {
        if (href === path || href.endsWith(path)) {
          references.push(`<link rel="${rel}" href="${href}">`);
          return false;
        }
      }
    });

    const details: Record<string, unknown> = {
      references,
      referenceCount: references.length,
      note: 'llms.txt is an emerging standard (llmstxt.org) - not yet required but recommended for AI visibility',
    };

    if (references.length > 0) {
      return pass(
        'geo-llms-txt',
        `llms.txt reference found (${references.length} reference(s))`,
        details
      );
    }

    return warn(
      'geo-llms-txt',
      'No llms.txt reference found - consider adding for AI discoverability',
      {
        ...details,
        recommendation:
          'Add <link rel="llms" href="/llms.txt"> in <head>, or create /llms.txt describing your site for LLMs (see llmstxt.org)',
      }
    );
  },
});
