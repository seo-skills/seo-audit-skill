import { readFileSync } from 'node:fs';

/**
 * The running package version, read from package.json rather than hardcoded.
 *
 * The published layout is dist/cli.js with package.json one level up, so this
 * resolves to the root manifest and can never drift from the released version.
 * Every entry point bundles to dist/, so the relative path holds regardless of
 * which source file asks.
 *
 * Falls back gracefully if the manifest cannot be read.
 */
export function getVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
    return typeof pkg.version === 'string' ? pkg.version : '0.0.0';
  } catch {
    return '0.0.0';
  }
}
