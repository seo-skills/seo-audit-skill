import type { AuditContext, SchemaNodeSummary } from '../../types.js';
import { defineRule, notMeasured, pass, warn } from '../define-rule.js';
import { loadSchemaNodes, NEEDS_ENTITY_CRAWL, NO_SCHEMA_NODES } from '../schema/entity-graph.js';

function isIdentity(node: SchemaNodeSummary): boolean {
  return node.types.some(
    (type) => type === 'Organization' || type.endsWith('Organization') || type.endsWith('Business')
  );
}

function phoneKey(value: string): string {
  const digits = value.replace(/\D/g, '');
  return digits.length > 10 ? digits.slice(-10) : digits;
}

function addressKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function nameKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/**
 * Rule: NAP consistency
 *
 * For one organization name, the phone number and postal address should
 * match across the crawl. Different names are treated as different places.
 */
export const napConsistencyRule = defineRule({
  id: 'eeat-nap-consistency',
  name: 'NAP Consistency',
  description: 'Checks that one organization name keeps a single phone number and address across the crawl',
  category: 'eeat',
  weight: 4,
  run: (context: AuditContext) => {
    const nodes = loadSchemaNodes(context);
    if (!nodes) {
      return notMeasured('eeat-nap-consistency', NEEDS_ENTITY_CRAWL);
    }
    if (nodes.length === 0) {
      return notMeasured('eeat-nap-consistency', NO_SCHEMA_NODES);
    }

    const phones = new Map<string, Set<string>>();
    const addresses = new Map<string, Set<string>>();
    const labels = new Map<string, string>();

    for (const node of nodes) {
      if (!isIdentity(node) || !node.name) continue;
      const key = nameKey(node.name);
      if (!key) continue;
      labels.set(key, node.name);
      if (node.telephone) {
        const phone = phoneKey(node.telephone);
        if (phone) {
          const set = phones.get(key) ?? new Set<string>();
          set.add(phone);
          phones.set(key, set);
        }
      }
      if (node.address) {
        const address = addressKey(node.address);
        if (address) {
          const set = addresses.get(key) ?? new Set<string>();
          set.add(address);
          addresses.set(key, set);
        }
      }
    }

    const issues: string[] = [];
    for (const [key, values] of phones) {
      if (values.size > 1) issues.push(`${labels.get(key)} has ${values.size} phone numbers`);
    }
    for (const [key, values] of addresses) {
      if (values.size > 1) issues.push(`${labels.get(key)} has ${values.size} addresses`);
    }

    if (issues.length === 0) {
      return pass('eeat-nap-consistency', 'Organization names agree on phone and address', { issues: [] });
    }

    return warn('eeat-nap-consistency', issues.slice(0, 4).join('; '), {
      issues,
      recommendation: 'Publish one phone number and one postal address for each organization name.',
    });
  },
});
