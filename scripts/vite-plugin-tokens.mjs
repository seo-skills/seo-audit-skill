/**
 * Regenerate `ui/styles/tokens.css` before any Vite build or dev server.
 *
 * Registered in both `vite.web.config.ts` and `electron/electron-vite.config.ts`
 * rather than as an npm `prebuild` script, because four commands reach Vite
 * directly — `web:build`, `web:dev`, `electron:build`, `electron:dev` — and a
 * prebuild hook would cover only the one that runs through `npm run build`.
 * The failure it prevents is quiet: a stale or missing token file leaves
 * Tailwind's aliases resolving to nothing and the app renders unstyled, and CI
 * never sees it because CI runs the one path that was covered.
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

export function designTokens() {
  return {
    name: 'seomator-design-tokens',
    buildStart() {
      execFileSync(process.execPath, [resolve(here, 'gen-tokens.mjs')], { stdio: 'inherit' });
    },
  };
}
