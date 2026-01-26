import type { AuditContext } from '../../types.js';
import { defineRule, pass, warn, fail } from '../define-rule.js';

/**
 * DOM size thresholds based on Lighthouse recommendations
 */
const THRESHOLDS = {
  nodes: { good: 800, warning: 1500 },
  depth: { good: 32, warning: 48 },
  children: { good: 60 },
};

interface DomStats {
  totalNodes: number;
  maxDepth: number;
  maxChildren: number;
  deepestSelector: string;
  widestSelector: string;
}

/**
 * Calculate DOM statistics
 */
function calculateDomStats($: AuditContext['$']): DomStats {
  let totalNodes = 0;
  let maxDepth = 0;
  let maxChildren = 0;
  let deepestSelector = '';
  let widestSelector = '';

  // Count all elements and analyze structure
  $('body *').each((_, el) => {
    totalNodes++;

    // Calculate depth by counting ancestors
    let depth = 0;
    let parent = $(el).parent();
    while (parent.length && parent[0] && parent[0].tagName !== 'html') {
      depth++;
      parent = parent.parent();
    }

    if (depth > maxDepth) {
      maxDepth = depth;
      const tagName = (el as unknown as { tagName?: string }).tagName?.toLowerCase() || 'unknown';
      const id = $(el).attr('id');
      const className = $(el).attr('class')?.split(' ')[0];
      deepestSelector = id ? `${tagName}#${id}` : className ? `${tagName}.${className}` : tagName;
    }

    // Count direct children
    const childCount = $(el).children().length;
    if (childCount > maxChildren) {
      maxChildren = childCount;
      const tagName = (el as unknown as { tagName?: string }).tagName?.toLowerCase() || 'unknown';
      const id = $(el).attr('id');
      const className = $(el).attr('class')?.split(' ')[0];
      widestSelector = id ? `${tagName}#${id}` : className ? `${tagName}.${className}` : tagName;
    }
  });

  return { totalNodes, maxDepth, maxChildren, deepestSelector, widestSelector };
}

/**
 * Rule: Check DOM size for performance impact
 *
 * Large DOM trees increase memory usage, slow style calculations,
 * and cause expensive reflows. Recommended limits:
 * - Total nodes: <800 (good), <1500 (acceptable)
 * - Max depth: <32 levels
 * - Max children per element: <60
 */
export const domSizeRule = defineRule({
  id: 'perf-dom-size',
  name: 'DOM Size',
  description: 'Checks DOM size for performance impact (nodes, depth, children)',
  category: 'perf',
  weight: 15,
  run: (context: AuditContext) => {
    const { $ } = context;
    const stats = calculateDomStats($);

    const issues: string[] = [];
    let severity: 'pass' | 'warn' | 'fail' = 'pass';

    // Check total nodes
    if (stats.totalNodes > THRESHOLDS.nodes.warning) {
      issues.push(`${stats.totalNodes.toLocaleString()} DOM nodes (recommended: <${THRESHOLDS.nodes.good})`);
      severity = 'fail';
    } else if (stats.totalNodes > THRESHOLDS.nodes.good) {
      issues.push(`${stats.totalNodes.toLocaleString()} DOM nodes (recommended: <${THRESHOLDS.nodes.good})`);
      severity = 'warn';
    }

    // Check max depth
    if (stats.maxDepth > THRESHOLDS.depth.warning) {
      issues.push(`Max depth: ${stats.maxDepth} (recommended: <${THRESHOLDS.depth.good})`);
      if (severity !== 'fail') severity = 'fail';
    } else if (stats.maxDepth > THRESHOLDS.depth.good) {
      issues.push(`Max depth: ${stats.maxDepth} at ${stats.deepestSelector}`);
      if (severity === 'pass') severity = 'warn';
    }

    // Check max children
    if (stats.maxChildren > THRESHOLDS.children.good) {
      issues.push(`Max children: ${stats.maxChildren} in ${stats.widestSelector} (recommended: <${THRESHOLDS.children.good})`);
      if (severity === 'pass') severity = 'warn';
    }

    const details = {
      totalNodes: stats.totalNodes,
      maxDepth: stats.maxDepth,
      maxChildren: stats.maxChildren,
      deepestSelector: stats.deepestSelector,
      widestSelector: stats.widestSelector,
      thresholds: THRESHOLDS,
    };

    if (severity === 'fail') {
      return fail('perf-dom-size', `DOM size is too large: ${issues.join('; ')}`, details);
    }

    if (severity === 'warn') {
      return warn('perf-dom-size', `DOM size could be optimized: ${issues.join('; ')}`, details);
    }

    return pass(
      'perf-dom-size',
      `DOM size is optimal (${stats.totalNodes.toLocaleString()} nodes, depth ${stats.maxDepth})`,
      details
    );
  },
});
