import type { AuditContext } from '../../types.js';
import { defineRule, notMeasured, pass, warn } from '../define-rule.js';
import { isAbsoluteId, loadSchemaNodes, NEEDS_ENTITY_CRAWL, NO_SCHEMA_NODES } from './entity-graph.js';

/**
 * Rule: Dangling schema @id references
 *
 * An article that points at a publisher @id which no crawled page declares
 * is a reference to nothing. Only absolute @ids are compared.
 */
export const entityDanglingRule = defineRule({
  id: 'schema-entity-dangling',
  name: 'Dangling Schema References',
  description: 'Checks that absolute publisher, author, and isPartOf @ids are declared somewhere in the crawl',
  category: 'schema',
  weight: 6,
  run: (context: AuditContext) => {
    const nodes = loadSchemaNodes(context);
    if (!nodes) {
      return notMeasured('schema-entity-dangling', NEEDS_ENTITY_CRAWL);
    }
    if (nodes.length === 0) {
      return notMeasured('schema-entity-dangling', NO_SCHEMA_NODES);
    }

    const declared = new Set(
      nodes.flatMap((node) => (node.id && isAbsoluteId(node.id) ? [node.id] : []))
    );
    const missing = new Set<string>();
    for (const node of nodes) {
      for (const ref of node.refs) {
        if (isAbsoluteId(ref) && !declared.has(ref)) missing.add(ref);
      }
    }

    if (missing.size === 0) {
      return pass('schema-entity-dangling', 'Schema @id references resolve inside the crawl', {
        missing: [],
      });
    }

    const list = [...missing];
    return warn(
      'schema-entity-dangling',
      `${list.length} schema @id reference(s) are never declared: ${list.slice(0, 3).join(', ')}`,
      {
        missing: list.slice(0, 10),
        recommendation:
          'Declare the referenced entity on at least one crawled page, or point the reference at an @id that page already publishes.',
      }
    );
  },
});
