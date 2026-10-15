import type { AuditContext } from '../../types.js';
import { defineRule, notMeasured, pass, warn } from '../define-rule.js';
import { isAbsoluteId, loadSchemaNodes, NEEDS_ENTITY_CRAWL, NO_SCHEMA_NODES } from './entity-graph.js';

/**
 * Rule: Same @id, different @type
 *
 * Types decide which rich results an entity can earn. Two pages that share
 * an @id and disagree on @type leave that choice unspecified.
 */
export const entityTypeDriftRule = defineRule({
  id: 'schema-entity-type-drift',
  name: 'Schema Type Drift',
  description: 'Checks that one absolute @id keeps the same @type across the crawl',
  category: 'schema',
  weight: 5,
  run: (context: AuditContext) => {
    const nodes = loadSchemaNodes(context);
    if (!nodes) {
      return notMeasured('schema-entity-type-drift', NEEDS_ENTITY_CRAWL);
    }
    if (nodes.length === 0) {
      return notMeasured('schema-entity-type-drift', NO_SCHEMA_NODES);
    }

    const typesById = new Map<string, Set<string>>();
    for (const node of nodes) {
      if (!node.id || !isAbsoluteId(node.id) || node.types.length === 0) continue;
      let set = typesById.get(node.id);
      if (!set) {
        set = new Set();
        typesById.set(node.id, set);
      }
      set.add([...node.types].sort().join('+'));
    }

    const drifts = [...typesById.entries()]
      .filter(([, types]) => types.size > 1)
      .map(([id, types]) => `${id}: ${[...types].join(' vs ')}`);

    if (drifts.length === 0) {
      return pass('schema-entity-type-drift', 'Absolute @ids keep a consistent @type', {
        drifts: [],
      });
    }

    return warn('schema-entity-type-drift', drifts.slice(0, 3).join('; '), {
      drifts,
      recommendation: 'Give each @id one @type on every page that declares it.',
    });
  },
});
