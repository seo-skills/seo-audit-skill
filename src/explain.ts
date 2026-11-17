/**
 * What a rule checks, how much it counts, and how to configure it.
 *
 * One implementation behind `seomator explain` and the MCP `explain_rule`
 * tool, so an agent and a person reading the terminal are told the same
 * thing. Requires the rule registry to be loaded.
 */

import { getAllRules, getRuleById } from './rules/registry.js';
import { getCategoryById } from './categories/index.js';
import { getFixSuggestion } from './reporters/fix-suggestions.js';
import { suggestClosest } from './config/suggest.js';

/** Everything `explain` says about one rule */
export interface RuleExplanation {
  id: string;
  name: string;
  category: string;
  categoryName: string;
  /** The rule's weight within its category */
  weight: number;
  /** The category's share of the overall score, in percent */
  categoryWeight: number;
  description: string;
  fix: string;
  /** Shown in reports but not counted in the score yet */
  advisory: boolean;
  /** Measured only with a browser render (`--cwv`) */
  requiresRender: boolean;
  /** The options the rule reads from `rule_options` */
  options: Array<{ key: string; type: string; default: unknown; min?: number; max?: number; description: string }>;
  /** Paste-ready `[rules.override]` lines for this rule */
  overrideExample: string;
  /** Paste-ready `rule_options` lines, when the rule reads options */
  optionsExample?: string;
}

/** A rule id `explain` could not find, with the ids it most likely meant */
export interface UnknownRule {
  unknown: string;
  suggestions: string[];
}

/** Explain one rule, or say which ids were probably meant */
export function explainRule(ruleId: string): RuleExplanation | UnknownRule {
  const rule = getRuleById(ruleId);
  if (!rule) {
    return {
      unknown: ruleId,
      suggestions: suggestClosest(ruleId, getAllRules().map((r) => r.id)),
    };
  }
  const category = getCategoryById(rule.category);
  return {
    id: rule.id,
    name: rule.name,
    category: rule.category,
    categoryName: category?.name ?? rule.category,
    weight: rule.weight,
    categoryWeight: category?.weight ?? 0,
    description: rule.description,
    fix: getFixSuggestion(rule.id),
    advisory: rule.advisory === true,
    requiresRender: rule.requiresRender === true,
    options: Object.entries(rule.options ?? {}).map(([key, spec]) => ({
      key,
      type: spec.type,
      default: spec.default,
      ...(spec.min !== undefined && { min: spec.min }),
      ...(spec.max !== undefined && { max: spec.max }),
      description: spec.description,
    })),
    ...(rule.options &&
      Object.keys(rule.options).length > 0 && {
        optionsExample: [
          `[rule_options."${rule.id}"]`,
          ...Object.entries(rule.options).map(([key, spec]) => `${key} = ${JSON.stringify(spec.default)}`),
        ].join('\n'),
      }),
    overrideExample: [
      '[rules.override]',
      `"${rule.id}" = { priority = "low" }    # high | normal | low | ignore`,
      `# "${rule.id}" = { fail_ci = true }  # exit 1 when it fails, at any score`,
    ].join('\n'),
  };
}

/** Plain-text explanation, identical for the CLI and the MCP tool */
export function formatExplanation(explanation: RuleExplanation): string {
  const lines = [
    `${explanation.id}: ${explanation.name}`,
    `Category: ${explanation.categoryName} (${explanation.category}, ${explanation.categoryWeight}% of the score)`,
    explanation.advisory
      ? `Weight: ${explanation.weight} within the category once promoted. Advisory: reported, not counted in the score yet`
      : `Weight: ${explanation.weight} within the category`,
    ...(explanation.requiresRender ? ['Needs a browser render: run with --render, or it is reported as not measured'] : []),
    '',
    explanation.description,
    '',
    `How to fix: ${explanation.fix}`,
  ];
  if (explanation.options.length > 0) {
    lines.push('', 'Options:');
    for (const option of explanation.options) {
      const range =
        option.min !== undefined || option.max !== undefined ? `, ${option.min ?? '-inf'} to ${option.max ?? 'inf'}` : '';
      lines.push(`  ${option.key} (${option.type}, default ${JSON.stringify(option.default)}${range}): ${option.description}`);
    }
  }
  lines.push('', 'Configure it in seomator.toml:', explanation.overrideExample);
  if (explanation.optionsExample) lines.push('', explanation.optionsExample);
  return lines.join('\n');
}

/** The message for an id that is not a rule */
export function formatUnknownRule(unknown: UnknownRule): string {
  const hint = unknown.suggestions.length > 0 ? ` Did you mean: ${unknown.suggestions.join(', ')}?` : '';
  return `Unknown rule id "${unknown.unknown}".${hint} Run \`seomator explain --list\` for every id.`;
}

/** Every rule id, optionally for one category, sorted */
export function listRuleIds(category?: string): Array<{ id: string; name: string; category: string }> {
  return getAllRules()
    .filter((rule) => !category || rule.category === category)
    .map((rule) => ({ id: rule.id, name: rule.name, category: rule.category }))
    .sort((a, b) => a.id.localeCompare(b.id));
}
