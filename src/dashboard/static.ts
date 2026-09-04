/**
 * Serving the built dashboard.
 *
 * Everything outside `/api` comes from `dist/web`. Two rules matter:
 *
 * - A path that resolves outside the root is a 404, and traversal is rejected
 *   before resolution — including percent-encoded and NUL-byte forms, which
 *   `path.resolve` would otherwise normalise into something that looks safe.
 * - The SPA fallback applies only to extension-less paths. A request for a
 *   hashed asset that no longer exists must fail loudly; serving index.html as
 *   JavaScript turns a stale bookmark into a syntax error nobody can read.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { ServerResponse } from 'http';

/** Content types for what a Vite build actually emits */
const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json; charset=utf-8',
};

/** Vite emits hashed filenames, which are safe to cache forever */
const HASHED_ASSET = /-[A-Za-z0-9_-]{8,}\.[a-z0-9]+$/;

export interface StaticAssets {
  /** Absolute path of the build directory */
  root: string;
  /** Whether `index.html` is actually there */
  available: boolean;
}

/** Locate the built dashboard next to the running CLI */
export function findWebAssets(distDir: string): StaticAssets {
  const root = path.resolve(distDir, 'web');
  return { root, available: fs.existsSync(path.join(root, 'index.html')) };
}

/**
 * Reject a request path before it is resolved.
 *
 * @returns Why it is unsafe, or null when it can be resolved
 */
export function unsafeReason(pathname: string): string | null {
  if (pathname.includes('\0')) return 'NUL byte';
  // Check the raw form as well as the decoded one: `%2e%2e%2f` decodes to
  // `../`, and a decoded check alone would miss `%252e%252e` double-encoding.
  const lowered = pathname.toLowerCase();
  if (lowered.includes('%2e') || lowered.includes('%2f') || lowered.includes('%5c')) {
    return 'encoded path separator';
  }
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return 'malformed percent-encoding';
  }
  if (decoded.includes('\0')) return 'NUL byte';
  if (decoded.split(/[/\\]/).includes('..')) return 'path traversal';
  return null;
}

/**
 * Resolve a URL path to a file inside the root.
 *
 * @returns The absolute file path, or null when it escapes the root or the
 *          request is unsafe
 */
export function resolveAsset(root: string, pathname: string): string | null {
  if (unsafeReason(pathname) !== null) return null;

  const relative = decodeURIComponent(pathname).replace(/^\/+/, '');
  const resolved = path.resolve(root, relative);
  // `path.resolve` collapses `..`, so compare after resolution too: a symlink
  // or an absolute component could still point outside.
  if (resolved !== root && !resolved.startsWith(root + path.sep)) return null;
  return resolved;
}

/** Whether a path should fall back to index.html when it does not exist */
export function isSpaRoute(pathname: string): boolean {
  return path.extname(pathname) === '';
}

export interface ServeStaticOptions {
  /** Headers added to every `index.html` response (CSP, framing, the token cookie) */
  documentHeaders: () => Record<string, string>;
}

/**
 * Serve one static request.
 *
 * @returns True when the request was answered
 */
export function serveStatic(
  assets: StaticAssets,
  pathname: string,
  res: ServerResponse,
  options: ServeStaticOptions
): boolean {
  if (!assets.available) return false;

  const resolved = resolveAsset(assets.root, pathname);
  if (resolved === null) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return true;
  }

  let file = resolved;
  let stat = statFile(file);

  if (stat === null || stat.isDirectory()) {
    // A directory or a missing path: index.html, but only for a route the SPA
    // could own. A missing `.js` stays a 404.
    if (!isSpaRoute(pathname) && stat === null) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return true;
    }
    file = path.join(assets.root, 'index.html');
    stat = statFile(file);
    if (stat === null) return false;
  }

  const extension = path.extname(file).toLowerCase();
  const isDocument = extension === '.html';
  const headers: Record<string, string> = {
    'Content-Type': CONTENT_TYPES[extension] ?? 'application/octet-stream',
    'Content-Length': String(stat.size),
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Cache-Control': isDocument
      ? 'no-store'
      : HASHED_ASSET.test(path.basename(file))
        ? 'public, max-age=31536000, immutable'
        : 'no-cache',
    ...(isDocument ? options.documentHeaders() : {}),
  };

  res.writeHead(200, headers);
  fs.createReadStream(file).pipe(res);
  return true;
}

function statFile(file: string): fs.Stats | null {
  try {
    return fs.statSync(file);
  } catch {
    return null;
  }
}
