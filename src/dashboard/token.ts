/**
 * The per-launch token file.
 *
 * `serve` writes `$SEOMATOR_HOME/serve.json` (0600) so an agent on the same
 * machine can find the port and the token without scraping stdout, and removes
 * it on shutdown. Loopback alone is not an authorization boundary: sandboxes,
 * forwarded ports and host-network containers all reach it.
 */

import * as fs from 'fs';
import * as path from 'path';
import { getGlobalDir } from '../storage/paths.js';

export interface ServeHandle {
  port: number;
  token: string;
  pid: number;
  startedAt: string;
}

export function getServeFilePath(): string {
  return path.join(getGlobalDir(), 'serve.json');
}

/** Write the handle with owner-only permissions */
export function writeServeFile(handle: ServeHandle, file = getServeFilePath()): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  // `mode` on writeFileSync only applies at creation, so an existing file from
  // a previous run keeps its old mode — remove it first.
  try {
    fs.unlinkSync(file);
  } catch {
    // Not there, which is the normal case
  }
  fs.writeFileSync(file, JSON.stringify(handle, null, 2), { mode: 0o600 });
}

/** Remove it; never throws, because it runs during shutdown */
export function removeServeFile(file = getServeFilePath()): void {
  try {
    fs.unlinkSync(file);
  } catch {
    // Already gone
  }
}

/** Read the handle a running server left behind, if any */
export function readServeFile(file = getServeFilePath()): ServeHandle | null {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as ServeHandle;
    if (typeof parsed.port !== 'number' || typeof parsed.token !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
}
