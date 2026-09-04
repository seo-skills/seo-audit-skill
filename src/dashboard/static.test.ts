import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { randomBytes } from 'crypto';
import { findWebAssets, isSpaRoute, resolveAsset, unsafeReason } from './static.js';

describe('unsafeReason', () => {
  it('accepts ordinary paths', () => {
    expect(unsafeReason('/')).toBeNull();
    expect(unsafeReason('/assets/index-a1b2c3d4.js')).toBeNull();
    expect(unsafeReason('/audits/2026-09-03-abc123')).toBeNull();
  });

  it('rejects traversal in every form it arrives in', () => {
    expect(unsafeReason('/../etc/passwd')).toBe('path traversal');
    expect(unsafeReason('/assets/../../etc/passwd')).toBe('path traversal');
    // Encoded separators never appear in a legitimate asset path, so they are
    // refused before decoding rather than after
    expect(unsafeReason('/%2e%2e/etc/passwd')).toBe('encoded path separator');
    expect(unsafeReason('/%2E%2E%2Fpasswd')).toBe('encoded path separator');
    expect(unsafeReason('/assets%2f..%2fsecret')).toBe('encoded path separator');
    expect(unsafeReason('/a%5c..%5cb')).toBe('encoded path separator');
    expect(unsafeReason('/foo\0.js')).toBe('NUL byte');
    expect(unsafeReason('/foo%00.js')).toBe('NUL byte');
    expect(unsafeReason('/%zz')).toBe('malformed percent-encoding');
  });
});

describe('resolveAsset', () => {
  const root = path.resolve('/tmp/web-root');

  it('resolves inside the root', () => {
    expect(resolveAsset(root, '/index.html')).toBe(path.join(root, 'index.html'));
    expect(resolveAsset(root, '/assets/app.js')).toBe(path.join(root, 'assets/app.js'));
    expect(resolveAsset(root, '/')).toBe(root);
  });

  it('refuses anything that escapes the root', () => {
    expect(resolveAsset(root, '/../secret')).toBeNull();
    expect(resolveAsset(root, '/%2e%2e/secret')).toBeNull();
    expect(resolveAsset(root, '/foo\0')).toBeNull();
  });

  it('does not treat a sibling directory with a shared prefix as inside', () => {
    // /tmp/web-root-evil must not pass a naive startsWith check
    expect(resolveAsset(root, '/../web-root-evil/x')).toBeNull();
  });
});

describe('isSpaRoute', () => {
  it('is true only for extension-less paths', () => {
    expect(isSpaRoute('/audits/2026-09-03-abc123')).toBe(true);
    expect(isSpaRoute('/')).toBe(true);
    // A missing hashed asset must 404 rather than render index.html as JS
    expect(isSpaRoute('/assets/index-a1b2c3d4.js')).toBe(false);
    expect(isSpaRoute('/favicon.ico')).toBe(false);
  });
});

describe('findWebAssets', () => {
  let dir: string;
  beforeAll(() => {
    dir = path.join(os.tmpdir(), `seomator-web-${randomBytes(4).toString('hex')}`);
    fs.mkdirSync(path.join(dir, 'web'), { recursive: true });
  });
  afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('reports the build as unavailable until index.html exists', () => {
    expect(findWebAssets(dir).available).toBe(false);
    fs.writeFileSync(path.join(dir, 'web/index.html'), '<!doctype html>');
    expect(findWebAssets(dir).available).toBe(true);
    expect(findWebAssets(dir).root).toBe(path.join(dir, 'web'));
  });
});
