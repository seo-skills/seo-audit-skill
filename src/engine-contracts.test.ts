/**
 * Engine contracts added with rule options, advisory rules and
 * not-measured reasons.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import * as http from 'node:http';
import type { AddressInfo } from 'node:net';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import './rules/loader.js';
import { Auditor } from './auditor.js';
import { registerRule } from './rules/registry.js';
import { defineRule, fail, countsTowardScore, resolveRuleOptions } from './rules/define-rule.js';
import { calculateCategoryScore, buildCategoryResult } from './scoring.js';
import { createTestContext } from './rules/test-context.js';
import { validateConfig } from './config/validator.js';
import { registryValidationContext } from './commands/run-config.js';
import { getPresetConfig } from './config/writer.js';
import { getDefaultConfig } from './config/defaults.js';
import { mergeConfigs } from './config/loader.js';
import { compareRunProfiles } from './storage/audits-db/run-profile.js';
import { runAudit } from './commands/audit.js';
import { soft404Rule } from './rules/technical/soft-404.js';
import type { AuditRunOptions, RuleResult } from './types.js';

afterEach(() => {
  vi.restoreAllMocks();
  process.exitCode = undefined;
});

describe('advisory results', () => {
  const scored: RuleResult = { ruleId: 'a', status: 'pass', message: '', score: 100, weight: 10 };
  const advisoryFail: RuleResult = { ruleId: 'b', status: 'fail', message: '', score: 0, weight: 10, advisory: true };

  it('do not move the category score', () => {
    expect(calculateCategoryScore([scored, advisoryFail])).toBe(calculateCategoryScore([scored]));
    expect(countsTowardScore(advisoryFail)).toBe(false);
  });

  it('are counted on their own line, not as failures', () => {
    const category = buildCategoryResult('core', [scored, advisoryFail]);
    expect(category.failCount).toBe(0);
    expect(category.advisoryCount).toBe(1);
  });
});

describe('a rule that crashes', () => {
  it('is not measured with reason rule-error, and a crashing advisory rule leaves the score alone', async () => {
    registerRule(
      defineRule({
        id: 'core-test-crashes',
        name: 'Crashes',
        description: 'Throws',
        category: 'core',
        weight: 25,
        run: () => {
          throw new Error('boom');
        },
      })
    );
    registerRule(
      defineRule({
        id: 'core-test-advisory-fails',
        name: 'Advisory fail',
        description: 'Fails, advisory',
        category: 'core',
        weight: 25,
        advisory: true,
        run: () => fail('core-test-advisory-fails', 'always fails'),
      })
    );

    const context = createTestContext('<html><head><title>T</title></head><body><h1>H</h1></body></html>');
    const auditor = new Auditor({ categories: ['core'] });
    const [core] = await auditor.auditPages([{ url: context.url, context }]);
    const crashed = core.results.find((r) => r.ruleId === 'core-test-crashes')!;
    expect(crashed.status).toBe('not-measured');
    expect(crashed.reason).toBe('rule-error');
    expect(crashed.weight).toBe(0);

    const advisory = core.results.find((r) => r.ruleId === 'core-test-advisory-fails')!;
    expect(advisory.advisory).toBe(true);
    const withoutTestRules = core.results.filter((r) => !r.ruleId.startsWith('core-test-'));
    expect(core.score).toBe(calculateCategoryScore(withoutTestRules));
  });
});

describe('rule options', () => {
  it('lay configured values over the declared defaults', () => {
    expect(resolveRuleOptions(soft404Rule, { min_words: 900, unknown: 1 })).toMatchObject({
      min_words: 900,
      min_words_body: 100,
    });
  });

  it('reject an undeclared key, a wrong type and an out-of-range number, naming the rule', () => {
    const context = registryValidationContext('error');
    const result = validateConfig(
      { rule_options: { 'technical-soft-404': { min_wrds: 3, min_words: 'many', min_words_body: 0 } } },
      context
    );
    const messages = result.errors.map((e) => e.message).join('\n');
    expect(messages).toContain('technical-soft-404 has no option "min_wrds". Did you mean "min_words"?');
    expect(messages).toContain('It reads: min_words (number, default 500');
    expect(messages).toContain('min_words (number, default 500, 1 to 100000) must be a number');
    expect(messages).toContain('must be at least 1');
  });

  it('an unknown rule id is an error in config validate and a warning when a run starts', () => {
    const config = { rule_options: { 'meta-tags/description-length': { min_length: 1 } } };
    expect(validateConfig(config, registryValidationContext('error')).errors[0].message).toContain('this entry is ignored');
    const atRun = validateConfig(config, registryValidationContext('warning'));
    expect(atRun.errors).toEqual([]);
    expect(atRun.warnings.some((w) => w.message.includes('is now "core-description-length"'))).toBe(true);
  });

  it('the blog preset writes a config that validates', () => {
    const config = mergeConfigs(getDefaultConfig(), getPresetConfig('blog'));
    expect(validateConfig(config, registryValidationContext('error')).errors).toEqual([]);
  });
});

describe('run profiles compare rule options', () => {
  const run = (ruleOptions?: Record<string, Record<string, unknown>>): AuditRunOptions => ({
    crawl: false,
    maxPages: 1,
    concurrency: 1,
    measureCwv: false,
    mobile: false,
    simulateInteraction: false,
    categories: [],
    timeout: 30000,
    ...(ruleOptions && { ruleOptions }),
  });

  it('reports different values as a material difference', () => {
    const differences = compareRunProfiles(
      run({ 'technical-soft-404': { min_words: 500 } }),
      run({ 'technical-soft-404': { min_words: 900 } })
    );
    expect(differences).toEqual([
      expect.objectContaining({ option: 'rule options', material: true }),
    ]);
  });

  it('reads the same values in a different order as the same', () => {
    expect(
      compareRunProfiles(
        run({ a: { x: 1, y: 2 }, b: { z: 3 } }),
        run({ b: { z: 3 }, a: { y: 2, x: 1 } })
      )
    ).toEqual([]);
  });

  it('reads absent as defaults', () => {
    expect(compareRunProfiles(run(), run())).toEqual([]);
    expect(compareRunProfiles(run(), run({ a: { x: 1 } }))[0]).toMatchObject({ previous: 'defaults' });
  });
});

describe('rule options end to end', () => {
  it('a configured threshold flips a verdict and is recorded on the run', async () => {
    const words = Array.from({ length: 600 }, (_, i) => `w${i}`).join(' ');
    const server = http.createServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end(`<html><head><title>Page not found | Shop</title></head><body><p>${words}</p></body></html>`);
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`;
    const dir = mkdtempSync(join(tmpdir(), 'seomator-options-'));

    const audit = async (toml: string) => {
      const configPath = join(dir, `${Math.random().toString(36).slice(2)}.toml`);
      writeFileSync(configPath, toml);
      const out: string[] = [];
      vi.spyOn(console, 'log').mockImplementation((...a) => void out.push(a.join(' ')));
      vi.spyOn(console, 'error').mockImplementation(() => {});
      await runAudit(url, {
        json: false, crawl: false, maxPages: 1, concurrency: 1, timeout: 5000, verbose: false,
        refresh: false, resume: false, save: false, format: 'json', failUnder: 0, config: configPath,
      });
      vi.restoreAllMocks();
      return JSON.parse(out.join('\n'));
    };

    try {
      const soft404 = (payload: { categoryResults: Array<{ results: RuleResult[] }> }) =>
        payload.categoryResults.flatMap((c) => c.results).find((r) => r.ruleId === 'technical-soft-404')!;

      const defaults = await audit('');
      expect(soft404(defaults).status).toBe('pass');

      const stricter = await audit('[rule_options."technical-soft-404"]\nmin_words = 1000\n');
      expect(soft404(stricter).status).toBe('fail');
      expect(stricter.run.ruleOptions).toEqual({ 'technical-soft-404': { min_words: 1000 } });
    } finally {
      server.close();
    }
  }, 30000);
});
