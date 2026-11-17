import chalk from 'chalk';
import { loadAllRules } from '../rules/loader.js';
import { getCategoryIds } from '../categories/index.js';
import { explainRule, formatExplanation, formatUnknownRule, listRuleIds } from '../explain.js';
import { emitCommandError } from './machine-error.js';

export interface ExplainOptions {
  /** List rule ids instead of explaining one; a string narrows to a category */
  list?: boolean | string;
  json?: boolean;
}

/**
 * `seomator explain <rule-id>` and `seomator explain --list [category]`.
 *
 * A finding names a rule id; this says what the rule checks, how much it
 * counts and how to configure it, without opening the docs.
 */
export async function runExplain(ruleId: string | undefined, options: ExplainOptions): Promise<void> {
  await loadAllRules();

  if (options.list !== undefined && options.list !== false) {
    const category = typeof options.list === 'string' ? options.list : undefined;
    if (category && !getCategoryIds().includes(category)) {
      emitCommandError({
        json: options.json === true,
        code: 'usage',
        message: `Unknown category "${category}".`,
        hint: `Valid: ${getCategoryIds().join(', ')}`,
        exitCode: 2,
      });
      return;
    }
    const rules = listRuleIds(category);
    if (options.json) {
      console.log(JSON.stringify(rules, null, 2));
    } else {
      for (const rule of rules) console.log(`${rule.id}  ${chalk.gray(rule.name)}`);
    }
    return;
  }

  if (!ruleId) {
    emitCommandError({
      json: options.json === true,
      code: 'usage',
      message: 'Name a rule id, or pass --list.',
      hint: 'Example: seomator explain core-canonical-present',
      exitCode: 2,
    });
    return;
  }

  const explanation = explainRule(ruleId);
  if ('unknown' in explanation) {
    emitCommandError({
      json: options.json === true,
      code: 'unknown-rule',
      message: formatUnknownRule(explanation),
      exitCode: 2,
    });
    return;
  }

  console.log(options.json ? JSON.stringify(explanation, null, 2) : formatExplanation(explanation));
}
