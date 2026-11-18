import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, notMeasured } from '../define-rule.js';

const ID = 'social-meta-multiple';

/** Properties the protocols allow more than once: arrays, not conflicts */
const ARRAYS = /^(?:og:image(?::(?:url|secure_url|type|width|height|alt))?|og:video(?::.*)?|og:audio(?::.*)?|og:locale:alternate|article:tag|article:author)$/;

/**
 * Rule: one value per social property
 *
 * Two `og:title` tags with different text, or two `twitter:description`
 * tags, leave the platform to pick one, and different platforms pick
 * differently. Arrays the protocol allows (several `og:image`) are fine.
 */
export const socialMetaMultipleRule = defineRule({
  id: ID,
  name: 'Social Meta Declared Once',
  description: 'Checks that each og:* and twitter:* property has one value (arrays such as og:image excepted)',
  category: 'social',
  weight: 2,
  advisory: true,
  run: (context: AuditContext) => {
    const { $ } = context;
    const values = new Map<string, Set<string>>();
    $('meta[property], meta[name]').each((_, el) => {
      const key = ($(el).attr('property') ?? $(el).attr('name') ?? '').trim().toLowerCase();
      if (!/^(?:og|twitter):/.test(key)) return;
      if (!values.has(key)) values.set(key, new Set());
      values.get(key)!.add(($(el).attr('content') ?? '').trim());
    });

    if (values.size === 0) {
      return notMeasured(ID, 'No Open Graph or Twitter tags on this page', undefined, 'not-applicable');
    }
    const conflicting = [...values]
      .filter(([key, set]) => set.size > 1 && !ARRAYS.test(key))
      .map(([property, set]) => ({ property, values: [...set] }));
    if (conflicting.length === 0) {
      return pass(ID, 'Each social property has one value', { properties: values.size });
    }
    return warn(ID, `Declared more than once with different values: ${conflicting.map((c) => c.property).join(', ')}`, {
      conflicting,
      recommendation: 'Keep one tag per property; platforms pick differently when there are several.',
    });
  },
});
