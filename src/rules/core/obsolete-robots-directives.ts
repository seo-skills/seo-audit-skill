import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, notMeasured } from '../define-rule.js';
import { parseRobotsDirectives } from './robots-meta.js';

const ID = 'core-obsolete-robots-directives';

/** Directives no search engine reads any more, and what they once did */
const OBSOLETE: Record<string, string> = {
  noodp: 'kept the Open Directory (DMOZ) description out of snippets; DMOZ closed in 2017',
  noydir: 'kept the Yahoo! Directory description out of snippets; the directory closed in 2014',
};

/**
 * Rule: robots directives that do nothing
 *
 * `noodp` and `noydir` pointed search engines away from web directories that
 * no longer exist. They are harmless, but they are noise in a place where
 * every word changes indexing, and they suggest the robots setup was copied
 * rather than reviewed.
 */
export const obsoleteRobotsDirectivesRule = defineRule({
  id: ID,
  name: 'Obsolete Robots Directives',
  description: 'Flags robots directives no search engine reads any more (noodp, noydir)',
  category: 'core',
  weight: 2,
  advisory: true,
  run: (context: AuditContext) => {
    const sources: Array<{ where: string; content: string }> = [];
    context.$('meta[name]').each((_, el) => {
      const name = (context.$(el).attr('name') ?? '').toLowerCase();
      if (['robots', 'googlebot', 'bingbot', 'slurp', 'msnbot'].includes(name)) {
        sources.push({ where: `<meta name="${name}">`, content: context.$(el).attr('content') ?? '' });
      }
    });
    if (context.headers['x-robots-tag']) sources.push({ where: 'X-Robots-Tag', content: context.headers['x-robots-tag'] });

    const found: Array<{ directive: string; where: string }> = [];
    for (const { where, content } of sources) {
      // Strip agent prefixes ("bingbot: noodp") before reading the directives
      for (const directive of parseRobotsDirectives(content.replace(/(^|,)\s*[a-z][a-z0-9_-]*\s*:\s*(?=no)/gi, '$1'))) {
        if (OBSOLETE[directive] && !found.some((f) => f.directive === directive && f.where === where)) found.push({ directive, where });
      }
    }

    if (sources.length === 0) {
      return notMeasured(ID, 'No robots directives on this page', undefined, 'not-applicable');
    }
    if (found.length === 0) {
      return pass(ID, 'No obsolete robots directives', { checked: sources.map((s) => s.where) });
    }
    const names = [...new Set(found.map((f) => f.directive))];
    return warn(ID, `${names.join(' and ')} ${names.length === 1 ? 'has' : 'have'} no effect and can be removed`, {
      found,
      why: names.map((name) => `${name}: ${OBSOLETE[name]}`),
      recommendation: `Remove ${names.join(' and ')} from the robots directives.`,
    });
  },
});
