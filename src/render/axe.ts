import type { RenderProbe } from './probes.js';

/** One axe rule that found problems on the page */
export interface AxeViolation {
  id: string;
  impact: 'minor' | 'moderate' | 'serious' | 'critical' | null;
  /** WCAG tags, such as wcag2aa or wcag143 */
  tags: string[];
  help: string;
  helpUrl: string;
  /** Elements affected */
  nodes: number;
  /** CSS selectors of the first few */
  targets: string[];
}

export interface AxeResult {
  version: string;
  violations: AxeViolation[];
}

let source: string | undefined;

/**
 * Runs axe-core in the rendered page: every rule except experimental and
 * deprecated ones, reporting violations only. "Needs review" results are
 * left out; they are noise as findings.
 */
export const AXE_PROBE: RenderProbe = {
  id: 'axe',
  family: 'accessibilityEngine',
  timeoutMs: 15_000,
  script: async () => {
    // Loaded on the first render only: 1.4 MB of script a static run never needs
    if (source === undefined) {
      // CommonJS: wrapped in `default` under ESM, bare under a CJS bundle
      const loaded = (await import('axe-core')) as unknown as { default?: { source: string }; source?: string };
      source = loaded.default?.source ?? loaded.source ?? '';
    }
    return `${source};
(async () => {
  const ids = axe.getRules()
    .filter((rule) => !rule.tags.includes('experimental') && !rule.tags.includes('deprecated'))
    .map((rule) => rule.ruleId);
  const result = await axe.run(document, { runOnly: { type: 'rule', values: ids }, resultTypes: ['violations'] });
  return {
    version: axe.version,
    violations: result.violations.map((v) => ({
      id: v.id,
      impact: v.impact || null,
      tags: v.tags.filter((tag) => /^wcag/.test(tag)),
      help: v.help,
      helpUrl: v.helpUrl,
      nodes: v.nodes.length,
      targets: v.nodes.slice(0, 5).map((node) => [].concat(node.target).join(' ')),
    })),
  };
})()`;
  },
};
