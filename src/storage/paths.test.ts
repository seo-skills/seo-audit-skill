import { describe, it, expect } from 'vitest';
import {
  getGlobalDir,
  getGlobalSettingsPath,
  getLinkCachePath,
  getProjectDir,
  getProjectSettingsPath,
  getCrawlsDir,
  getReportsDir,
  generateId,
} from './paths.js';
import * as os from 'os';
import * as path from 'path';

describe('paths', () => {
  describe('getGlobalDir', () => {
    it('should return ~/.seomator on Unix', () => {
      const globalDir = getGlobalDir();
      expect(globalDir).toBe(path.join(os.homedir(), '.seomator'));
    });
  });

  describe('getGlobalSettingsPath', () => {
    it('should return settings.json in global dir', () => {
      const settingsPath = getGlobalSettingsPath();
      expect(settingsPath).toBe(path.join(os.homedir(), '.seomator', 'settings.json'));
    });
  });

  describe('getLinkCachePath', () => {
    it('should return link-cache.db in global dir', () => {
      const cachePath = getLinkCachePath();
      expect(cachePath).toBe(path.join(os.homedir(), '.seomator', 'link-cache.db'));
    });
  });

  describe('getProjectDir', () => {
    it('should return .seomator in given directory', () => {
      const projectDir = getProjectDir('/some/project');
      expect(projectDir).toBe('/some/project/.seomator');
    });
  });

  describe('getProjectSettingsPath', () => {
    it('should return settings.json in project dir', () => {
      const settingsPath = getProjectSettingsPath('/some/project');
      expect(settingsPath).toBe('/some/project/.seomator/settings.json');
    });
  });

  describe('getCrawlsDir', () => {
    it('should return crawls subdirectory', () => {
      const crawlsDir = getCrawlsDir('/some/project');
      expect(crawlsDir).toBe('/some/project/.seomator/crawls');
    });
  });

  describe('getReportsDir', () => {
    it('should return reports subdirectory', () => {
      const reportsDir = getReportsDir('/some/project');
      expect(reportsDir).toBe('/some/project/.seomator/reports');
    });
  });

  describe('generateId', () => {
    it('should generate ID in format YYYY-MM-DD-xxxxxx', () => {
      const id = generateId();
      // Should match pattern: 2024-01-23-abc123
      expect(id).toMatch(/^\d{4}-\d{2}-\d{2}-[a-z0-9]{6}$/);
    });

    it('should include current date', () => {
      const id = generateId();
      const today = new Date().toISOString().split('T')[0];
      expect(id.startsWith(today)).toBe(true);
    });

    it('should generate unique IDs', () => {
      const id1 = generateId();
      const id2 = generateId();
      expect(id1).not.toBe(id2);
    });
  });
});
