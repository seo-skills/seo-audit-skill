import * as os from 'os';
import * as path from 'path';

/**
 * Get global seomator directory (~/.seomator)
 */
export function getGlobalDir(): string {
  return path.join(os.homedir(), '.seomator');
}

/**
 * Get global settings file path
 */
export function getGlobalSettingsPath(): string {
  return path.join(getGlobalDir(), 'settings.json');
}

/**
 * Get global link cache database path
 */
export function getLinkCachePath(): string {
  return path.join(getGlobalDir(), 'link-cache.db');
}

/**
 * Get project seomator directory (.seomator)
 */
export function getProjectDir(baseDir: string): string {
  return path.join(baseDir, '.seomator');
}

/**
 * Get project settings file path
 */
export function getProjectSettingsPath(baseDir: string): string {
  return path.join(getProjectDir(baseDir), 'settings.json');
}

/**
 * Get crawls directory
 */
export function getCrawlsDir(baseDir: string): string {
  return path.join(getProjectDir(baseDir), 'crawls');
}

/**
 * Get reports directory
 */
export function getReportsDir(baseDir: string): string {
  return path.join(getProjectDir(baseDir), 'reports');
}

/**
 * Generate a unique ID for crawls/reports
 * Format: YYYY-MM-DD-xxxxxx
 */
export function generateId(): string {
  const date = new Date().toISOString().split('T')[0];
  const hash = Math.random().toString(36).substring(2, 8);
  return `${date}-${hash}`;
}
