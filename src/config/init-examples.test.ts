/**
 * `seomator init` writes commented examples that are valid once uncommented.
 */
import { describe, it, expect, afterEach } from 'vitest';
import * as TOML from '@iarna/toml';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import '../rules/loader.js';
import { INIT_EXAMPLES, writeConfigFile, getPresetConfig } from './index.js';
import { validateConfig } from './validator.js';
import { getDefaultConfig } from './defaults.js';
import { mergeConfigs } from './loader.js';
import { registryValidationContext } from '../commands/run-config.js';

const dirs: string[] = [];
afterEach(() => {
  while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true });
});

describe('init examples', () => {
  it('leave the written file valid TOML with the examples commented out', () => {
    const dir = mkdtempSync(join(tmpdir(), 'seomator-init-'));
    dirs.push(dir);
    const file = join(dir, 'seomator.toml');
    writeConfigFile(file, getPresetConfig('blog'));
    const text = readFileSync(file, 'utf8');
    expect(text).toContain('# [[custom.search]]');
    expect(() => TOML.parse(text)).not.toThrow();
  });

  it('validate once uncommented', () => {
    const uncommented = INIT_EXAMPLES.split('\n')
      .filter((line) => line.startsWith('# ') && !line.startsWith('# ---') && /^# (\[|[a-z_]+ =)/.test(line))
      .map((line) => line.slice(2))
      .join('\n');
    const parsed = TOML.parse(uncommented) as Record<string, unknown>;
    const config = mergeConfigs(getDefaultConfig(), parsed);
    const result = validateConfig(config, registryValidationContext('error'));
    expect(result.errors).toEqual([]);
  });
});
