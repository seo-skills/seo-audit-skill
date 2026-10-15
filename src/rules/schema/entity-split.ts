import type { AuditContext, SchemaNodeSummary } from '../../types.js';
import { defineRule, notMeasured, pass, warn } from '../define-rule.js';
import { isAbsoluteId, loadSchemaNodes, NEEDS_ENTITY_CRAWL, NO_SCHEMA_NODES } from './entity-graph.js';

function isIdentity(node: SchemaNodeSummary): boolean {
  return node.types.some(
    (type) => type === 'Organization' || type === 'Person' || type.endsWith('Organization') || type.endsWith('Business')
  );
}

function normalName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/**
 * Rule: One name, two @ids
 *
 * Two plugins that each mint an @id for "Acme" leave a search engine with
 * two organizations. Relative @ids are ignored.
 */
export const entitySplitRule = defineRule({
  id: 'schema-entity-split',
  name: 'Split Schema Identity',
  description: 'Checks that one organization or person name is not published under two absolute @ids',
  category: 'schema',
  weight: 6,
  run: (context: AuditContext) => {
    const nodes = loadSchemaNodes(context);
    if (!nodes) {
      return notMeasured('schema-entity-split', NEEDS_ENTITY_CRAWL);
    }
    if (nodes.length === 0) {
      return notMeasured('schema-entity-split', NO_SCHEMA_NODES);
    }

    const idsByName = new Map<string, Set<string>>();
    for (const node of nodes) {
      if (!isIdentity(node) || !node.name || !node.id || !isAbsoluteId(node.id)) continue;
      const name = normalName(node.name);
      if (!name) continue;
      const set = idsByName.get(name) ?? new Set<string>();
      set.add(node.id);
      idsByName.set(name, set);
    }

    const splits = [...idsByName.entries()]
      .filter(([, ids]) => ids.size > 1)
      .map(([name, ids]) => `${name}: ${[...ids].join(', ')}`);

    if (splits.length === 0) {
      return pass('schema-entity-split', 'Each named identity uses one absolute @id', { splits: [] });
    }

    return warn('schema-entity-split', `One name is published under more than one @id: ${splits[0]}`, {
      splits,
      recommendation: 'Pick one absolute @id for that name and reuse it everywhere.',
    });
  },
});
