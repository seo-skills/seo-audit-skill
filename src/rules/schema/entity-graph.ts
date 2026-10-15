import type { AuditContext, SchemaNodeSummary } from '../../types.js';

/** A crawl of one page cannot show whether entities agree with each other. */
export const NEEDS_ENTITY_CRAWL =
  'Schema identity across pages needs a crawl of at least two pages — run with --crawl';

/** A crawl whose pages carry no JSON-LD gives the entity checks nothing to compare. */
export const NO_SCHEMA_NODES = 'No structured data on the crawled pages to compare';

/**
 * Every JSON-LD summary recorded for the crawl.
 *
 * @param context - The audit context
 * @returns The nodes, or null when the crawl graph is absent or too small
 */
export function loadSchemaNodes(context: AuditContext): SchemaNodeSummary[] | null {
  const site = context.site;
  if (!site?.pages || site.pageCount < 2) return null;

  const nodes: SchemaNodeSummary[] = [];
  for (const info of site.pages.values()) {
    if (info.schemaNodes) nodes.push(...info.schemaNodes);
  }
  return nodes;
}

/** True when the value is an absolute http(s) URL. */
export function isAbsoluteId(value: string): boolean {
  return /^https?:\/\//i.test(value);
}
