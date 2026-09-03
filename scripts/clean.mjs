#!/usr/bin/env node
/**
 * Remove build output.
 *
 * tsup used to do this with `clean: true`, but `dist/` now holds two builds:
 * the CLI bundle and the dashboard's static assets. Whichever ran second would
 * wipe the first. Cleaning once, up front, keeps `npm run build:cli` from
 * deleting the web assets someone just built.
 */
import { rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
for (const target of ['dist']) {
  rmSync(resolve(root, target), { recursive: true, force: true });
  console.log(`clean: removed ${target}/`);
}
