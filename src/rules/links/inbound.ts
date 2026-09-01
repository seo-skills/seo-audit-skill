import type { AuditContext, InboundEdge } from '../../types.js';

/**
 * Reads the per-edge inbound link list for the audited URL from the site graph.
 *
 * Shared prelude for the inbound-link-quality rules: returns null when the
 * crawl-time graph (or its per-edge data) is absent, in which case the rule
 * reports notMeasured — a single-page audit cannot answer cross-page
 * questions. An empty array is a real reading ("nothing links here"), left to
 * each rule to interpret.
 *
 * @param context - The audit context
 * @returns The inbound edges for this URL, or null when unmeasurable
 */
export function getInboundEdges(context: AuditContext): InboundEdge[] | null {
  const site = context.site;
  if (!site?.inboundEdgesByUrl) return null;
  return site.inboundEdgesByUrl.get(site.normalize(context.url)) ?? [];
}

/**
 * Standard notMeasured message for rules that need the site-wide link graph.
 */
export const NEEDS_SITE_GRAPH_MESSAGE =
  'Inbound link analysis needs the site-wide link graph - run with --crawl to build it';
