import type { PartialSeomatorConfig, SeomatorConfig } from './schema.js';

/**
 * Validation error/warning details
 */
export interface ValidationError {
  /** Configuration path that has the issue */
  path: string;
  /** Human-readable message */
  message: string;
  /** The invalid value (if applicable) */
  value?: unknown;
}

/**
 * Result of config validation
 */
export interface ValidationResult {
  /** Whether the config is valid (no errors) */
  valid: boolean;
  /** Errors that prevent config from being used */
  errors: ValidationError[];
  /** Warnings about suboptimal values */
  warnings: ValidationError[];
}

/**
 * Valid output formats
 */
const VALID_OUTPUT_FORMATS = ['console', 'text', 'json', 'html', 'markdown', 'llm'] as const;

/**
 * Validation rules with ranges
 */
const VALIDATION_RULES = {
  'crawler.max_pages': { min: 1, max: 10000, warnAbove: 5000 },
  'crawler.concurrency': { min: 1, max: 20, warnAbove: 10 },
  'crawler.per_host_concurrency': { min: 1, max: 5 },
  'crawler.per_host_delay_ms': { min: 0, max: 60000 },
  'crawler.timeout_ms': { min: 1000, max: 300000 },
  'crawler.delay_ms': { min: 0, max: 60000 },
  'crawler.max_prefix_budget': { min: 0, max: 1 },
  'external_links.cache_ttl_days': { min: 0, max: 365 },
  'external_links.timeout_ms': { min: 1000, max: 60000 },
  'external_links.concurrency': { min: 1, max: 20 },
} as const;

/**
 * Get nested value from object by dot-separated path
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/**
 * Validate a numeric value against rules
 */
function validateNumber(
  value: unknown,
  path: string,
  rules: { min: number; max: number; warnAbove?: number },
  errors: ValidationError[],
  warnings: ValidationError[]
): void {
  if (value === undefined) {
    return; // Optional field, skip validation
  }

  if (typeof value !== 'number' || isNaN(value)) {
    errors.push({
      path,
      message: `${path} must be a number`,
      value,
    });
    return;
  }

  if (value < rules.min || value > rules.max) {
    errors.push({
      path,
      message: `${path} must be between ${rules.min} and ${rules.max}`,
      value,
    });
    return;
  }

  if (rules.warnAbove !== undefined && value > rules.warnAbove) {
    warnings.push({
      path,
      message: `${path} is high (>${rules.warnAbove}), may cause performance issues`,
      value,
    });
  }
}

/**
 * Validate array of strings
 */
function validateStringArray(
  value: unknown,
  path: string,
  errors: ValidationError[]
): void {
  if (value === undefined) {
    return; // Optional field
  }

  if (!Array.isArray(value)) {
    errors.push({
      path,
      message: `${path} must be an array`,
      value,
    });
    return;
  }

  for (let i = 0; i < value.length; i++) {
    if (typeof value[i] !== 'string') {
      errors.push({
        path: `${path}[${i}]`,
        message: `${path}[${i}] must be a string`,
        value: value[i],
      });
    }
  }
}

/**
 * Validate output format
 */
function validateOutputFormat(
  value: unknown,
  errors: ValidationError[]
): void {
  if (value === undefined) {
    return;
  }

  if (typeof value !== 'string') {
    errors.push({
      path: 'output.format',
      message: 'output.format must be a string',
      value,
    });
    return;
  }

  if (!VALID_OUTPUT_FORMATS.includes(value as typeof VALID_OUTPUT_FORMATS[number])) {
    errors.push({
      path: 'output.format',
      message: `output.format must be one of: ${VALID_OUTPUT_FORMATS.join(', ')}`,
      value,
    });
  }
}

/**
 * Validate domain names
 */
function validateDomains(
  value: unknown,
  errors: ValidationError[],
  warnings: ValidationError[]
): void {
  if (value === undefined) {
    return;
  }

  if (!Array.isArray(value)) {
    errors.push({
      path: 'project.domains',
      message: 'project.domains must be an array',
      value,
    });
    return;
  }

  const domainPattern = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*$/;

  for (let i = 0; i < value.length; i++) {
    const domain = value[i];
    if (typeof domain !== 'string') {
      errors.push({
        path: `project.domains[${i}]`,
        message: `project.domains[${i}] must be a string`,
        value: domain,
      });
    } else if (!domainPattern.test(domain)) {
      warnings.push({
        path: `project.domains[${i}]`,
        message: `project.domains[${i}] may not be a valid domain name`,
        value: domain,
      });
    }
  }
}

/**
 * Validate boolean fields
 */
function validateBoolean(
  value: unknown,
  path: string,
  errors: ValidationError[]
): void {
  if (value === undefined) {
    return;
  }

  if (typeof value !== 'boolean') {
    errors.push({
      path,
      message: `${path} must be a boolean`,
      value,
    });
  }
}

/**
 * Validate a partial or complete SEOmator configuration
 * @param config - Configuration to validate
 * @returns Validation result with errors and warnings
 */
export function validateConfig(config: PartialSeomatorConfig | SeomatorConfig): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  const configObj = config as Record<string, unknown>;

  // Validate numeric fields with ranges
  for (const [path, rules] of Object.entries(VALIDATION_RULES)) {
    const value = getNestedValue(configObj, path);
    validateNumber(value, path, rules, errors, warnings);
  }

  // Validate string arrays
  const stringArrayPaths = [
    'crawler.include',
    'crawler.exclude',
    'crawler.allow_query_params',
    'crawler.drop_query_prefixes',
    'rules.enable',
    'rules.disable',
  ];

  for (const path of stringArrayPaths) {
    const value = getNestedValue(configObj, path);
    validateStringArray(value, path, errors);
  }

  // Validate boolean fields
  const booleanPaths = [
    'crawler.respect_robots',
    'crawler.breadth_first',
    'crawler.follow_redirects',
    'external_links.enabled',
  ];

  for (const path of booleanPaths) {
    const value = getNestedValue(configObj, path);
    validateBoolean(value, path, errors);
  }

  // Validate output format
  const outputFormat = getNestedValue(configObj, 'output.format');
  validateOutputFormat(outputFormat, errors);

  // Validate output.save
  const outputSave = getNestedValue(configObj, 'output.save');
  if (outputSave !== undefined && typeof outputSave !== 'boolean') {
    errors.push({
      path: 'output.save',
      message: 'output.save must be true or false',
      value: outputSave,
    });
  }

  // Validate output path
  const outputPath = getNestedValue(configObj, 'output.path');
  if (outputPath !== undefined && typeof outputPath !== 'string') {
    errors.push({
      path: 'output.path',
      message: 'output.path must be a string',
      value: outputPath,
    });
  }

  // Validate project name
  const projectName = getNestedValue(configObj, 'project.name');
  if (projectName !== undefined && typeof projectName !== 'string') {
    errors.push({
      path: 'project.name',
      message: 'project.name must be a string',
      value: projectName,
    });
  }

  // Validate user_agent (optional string)
  const userAgent = getNestedValue(configObj, 'crawler.user_agent');
  if (userAgent !== undefined && typeof userAgent !== 'string') {
    errors.push({
      path: 'crawler.user_agent',
      message: 'crawler.user_agent must be a string',
      value: userAgent,
    });
  }

  // Validate domains
  const domains = getNestedValue(configObj, 'project.domains');
  validateDomains(domains, errors, warnings);

  // Validate rule_options is an object
  const ruleOptions = getNestedValue(configObj, 'rule_options');
  if (ruleOptions !== undefined && (typeof ruleOptions !== 'object' || ruleOptions === null || Array.isArray(ruleOptions))) {
    errors.push({
      path: 'rule_options',
      message: 'rule_options must be an object',
      value: ruleOptions,
    });
  }

  // A rule filter changes the score: fewer checks, and a category left with no
  // rules is dropped rather than scored. Worth saying once, so a score that
  // moved for a config reason is not read as a site regression.
  const rulesSection = getNestedValue(configObj, 'rules') as
    | { enable?: string[]; disable?: string[] }
    | undefined;
  if (selectsRuleSubset(rulesSection)) {
    warnings.push({
      path: 'rules',
      message: RULE_FILTER_NOTICE,
      value: rulesSection,
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Said once when a config narrows the rule set.
 *
 * A filter removes checks outright, and a category left with no rules is
 * dropped from the result rather than scored zero, so the score moves without
 * the site changing. `compare` reports that as a run difference rather than a
 * regression, and this is the heads-up that it will.
 */
export const RULE_FILTER_NOTICE =
  'a rule filter is in force, so this score is not comparable to an unfiltered ' +
  'audit. `compare` reports the difference rather than calling it a regression.';

/**
 * Whether `[rules]` asks for anything other than "run everything".
 *
 * The default is `enable = ["*"]`, and an empty `enable` also means all rules,
 * so neither narrows the audit. Callers use this to tell a real filter from
 * the default, which matters because a filtered run is not comparable to a
 * full one — see `storage/audits-db/run-profile.ts`.
 */
export function selectsRuleSubset(rules: { enable?: string[]; disable?: string[] } | undefined): boolean {
  if (!rules) return false;
  const enable = rules.enable ?? [];
  const disable = rules.disable ?? [];
  const narrowsByEnable = enable.length > 0 && !(enable.length === 1 && enable[0] === '*');
  return narrowsByEnable || disable.length > 0;
}

/**
 * Format validation result as human-readable string
 */
export function formatValidationResult(result: ValidationResult): string {
  const lines: string[] = [];

  if (result.valid && result.warnings.length === 0) {
    lines.push('Configuration is valid.');
    return lines.join('\n');
  }

  if (result.errors.length > 0) {
    lines.push(`Errors (${result.errors.length}):`);
    for (const error of result.errors) {
      lines.push(`  - ${error.path}: ${error.message}`);
      if (error.value !== undefined) {
        lines.push(`    Value: ${JSON.stringify(error.value)}`);
      }
    }
  }

  if (result.warnings.length > 0) {
    if (lines.length > 0) lines.push('');
    lines.push(`Warnings (${result.warnings.length}):`);
    for (const warning of result.warnings) {
      lines.push(`  - ${warning.path}: ${warning.message}`);
      if (warning.value !== undefined) {
        lines.push(`    Value: ${JSON.stringify(warning.value)}`);
      }
    }
  }

  return lines.join('\n');
}
