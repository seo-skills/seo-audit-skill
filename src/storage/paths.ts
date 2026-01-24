import * as os from 'os';
import * as path from 'path';

/**
 * Get global seomator directory (~/.seomator)
 */
export function getGlobalDir(): string {
  return path.join(os.homedir(), '.seomator');
}

// =============================================================================
// Project Database Paths (per-domain SQLite databases)
// =============================================================================

/**
 * Get projects directory (~/.seomator/projects)
 */
export function getProjectsDir(): string {
  return path.join(getGlobalDir(), 'projects');
}

/**
 * Get project directory for a specific domain (~/.seomator/projects/<domain>)
 * The domain is sanitized to be filesystem-safe
 *
 * @param domain - Domain name (e.g., "example.com")
 */
export function getProjectDbDir(domain: string): string {
  const safeDomain = sanitizeDomain(domain);
  return path.join(getProjectsDir(), safeDomain);
}

/**
 * Get project database path for a domain (~/.seomator/projects/<domain>/project.db)
 *
 * @param domain - Domain name (e.g., "example.com")
 */
export function getProjectDbPath(domain: string): string {
  return path.join(getProjectDbDir(domain), 'project.db');
}

/**
 * Get audits database path (~/.seomator/audits.db)
 * This is a centralized database for all audit results
 */
export function getAuditsDbPath(): string {
  return path.join(getGlobalDir(), 'audits.db');
}

/**
 * Extract domain from a URL
 *
 * @param url - Full URL (e.g., "https://www.example.com/path")
 * @returns Domain without www prefix (e.g., "example.com")
 */
export function extractDomain(url: string): string {
  try {
    const parsed = new URL(url);
    let hostname = parsed.hostname.toLowerCase();

    // Remove www. prefix for consistency
    if (hostname.startsWith('www.')) {
      hostname = hostname.slice(4);
    }

    return hostname;
  } catch {
    // If URL parsing fails, try to extract domain manually
    const match = url.match(/(?:https?:\/\/)?(?:www\.)?([^\/\s:]+)/i);
    return match?.[1]?.toLowerCase() ?? 'unknown';
  }
}

/**
 * Sanitize domain name for use as directory name
 * Replaces unsafe characters with underscores
 *
 * @param domain - Domain name
 * @returns Filesystem-safe domain string
 */
export function sanitizeDomain(domain: string): string {
  return domain
    .toLowerCase()
    .replace(/[^a-z0-9.-]/g, '_')
    .replace(/\.+/g, '.')
    .replace(/_+/g, '_')
    .replace(/^[._-]+|[._-]+$/g, '');
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
