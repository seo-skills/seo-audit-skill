import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { findConfigFile, loadConfig, mergeConfigs, parseConfigFile } from './loader.js';
import { getDefaultConfig } from './defaults.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('mergeConfigs', () => {
  it('should merge partial config with defaults', () => {
    const defaults = getDefaultConfig();
    const partial = {
      project: { name: 'my-site' },
      crawler: { max_pages: 50 },
    };

    const merged = mergeConfigs(defaults, partial);

    expect(merged.project.name).toBe('my-site');
    expect(merged.project.domains).toEqual([]);
    expect(merged.crawler.max_pages).toBe(50);
    expect(merged.crawler.concurrency).toBe(3);
  });

  it('should handle empty partial config', () => {
    const defaults = getDefaultConfig();
    const partial = {};

    const merged = mergeConfigs(defaults, partial);

    expect(merged).toEqual(defaults);
  });

  it('should deeply merge nested objects', () => {
    const defaults = getDefaultConfig();
    const partial = {
      rules: { disable: ['rule-1', 'rule-2'] },
    };

    const merged = mergeConfigs(defaults, partial);

    expect(merged.rules.enable).toEqual(['*']);
    expect(merged.rules.disable).toEqual(['rule-1', 'rule-2']);
  });

  it('should override arrays completely', () => {
    const defaults = getDefaultConfig();
    const partial = {
      crawler: { include: ['/blog/*'] },
    };

    const merged = mergeConfigs(defaults, partial);

    expect(merged.crawler.include).toEqual(['/blog/*']);
  });
});

describe('findConfigFile', () => {
  const testDir = path.join(os.tmpdir(), 'seomator-test-' + Date.now());
  const subDir = path.join(testDir, 'sub', 'dir');

  beforeEach(() => {
    fs.mkdirSync(subDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it('should find seomator.toml in current directory', () => {
    fs.writeFileSync(path.join(testDir, 'seomator.toml'), '[project]\nname = "test"');

    const found = findConfigFile(testDir);
    expect(found).toBe(path.join(testDir, 'seomator.toml'));
  });

  it('should find seomator.toml in parent directory', () => {
    fs.writeFileSync(path.join(testDir, 'seomator.toml'), '[project]\nname = "test"');

    const found = findConfigFile(subDir);
    expect(found).toBe(path.join(testDir, 'seomator.toml'));
  });

  it('should return null if no config found', () => {
    const found = findConfigFile(subDir);
    expect(found).toBeNull();
  });

  it('should prefer config in current directory over parent', () => {
    fs.writeFileSync(path.join(testDir, 'seomator.toml'), '[project]\nname = "parent"');
    fs.writeFileSync(path.join(subDir, 'seomator.toml'), '[project]\nname = "child"');

    const found = findConfigFile(subDir);
    expect(found).toBe(path.join(subDir, 'seomator.toml'));
  });
});

describe('loadConfig', () => {
  const testDir = path.join(os.tmpdir(), 'seomator-load-test-' + Date.now());

  beforeEach(() => {
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it('should return defaults when no config exists', () => {
    const { config, configPath } = loadConfig(testDir);

    expect(configPath).toBeNull();
    expect(config.project.name).toBe('');
    expect(config.crawler.max_pages).toBe(100);
  });

  it('should load and merge TOML config', () => {
    const tomlContent = `[project]
name = "my-project"

[crawler]
max_pages = 200
`;
    fs.writeFileSync(path.join(testDir, 'seomator.toml'), tomlContent);

    const { config, configPath } = loadConfig(testDir);

    expect(configPath).toBe(path.join(testDir, 'seomator.toml'));
    expect(config.project.name).toBe('my-project');
    expect(config.crawler.max_pages).toBe(200);
    expect(config.crawler.concurrency).toBe(3); // default preserved
  });

  it('should apply CLI overrides with highest priority', () => {
    const tomlContent = `[project]
name = "from-toml"

[crawler]
max_pages = 200
`;
    fs.writeFileSync(path.join(testDir, 'seomator.toml'), tomlContent);

    const cliOverrides = {
      project: { name: 'from-cli' },
      crawler: { max_pages: 50 },
    };

    const { config } = loadConfig(testDir, cliOverrides);

    expect(config.project.name).toBe('from-cli');
    expect(config.crawler.max_pages).toBe(50);
  });

  it('should load local project settings', () => {
    const projectSettingsDir = path.join(testDir, '.seomator');
    fs.mkdirSync(projectSettingsDir, { recursive: true });
    fs.writeFileSync(
      path.join(projectSettingsDir, 'settings.json'),
      JSON.stringify({ project: { name: 'from-local-settings' } })
    );

    const { config } = loadConfig(testDir);

    expect(config.project.name).toBe('from-local-settings');
  });
});

describe('parseConfigFile', () => {
  const testDir = path.join(os.tmpdir(), 'seomator-parse-test-' + Date.now());

  beforeEach(() => {
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it('should throw user-friendly error for invalid TOML', () => {
    const invalidToml = `[project
name = "broken"`;
    const filePath = path.join(testDir, 'seomator.toml');
    fs.writeFileSync(filePath, invalidToml);

    expect(() => parseConfigFile(filePath)).toThrow(`Failed to parse ${filePath}`);
  });

  it('should parse valid TOML successfully', () => {
    const validToml = `[project]
name = "valid"`;
    const filePath = path.join(testDir, 'seomator.toml');
    fs.writeFileSync(filePath, validToml);

    const result = parseConfigFile(filePath);
    expect(result.project?.name).toBe('valid');
  });
});
