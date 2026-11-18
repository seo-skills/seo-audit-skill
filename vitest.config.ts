import { defineConfig } from 'vitest/config';
import { resolve } from 'path';
// @ts-expect-error -- plain .mjs plugin, no types needed
import { inlineAssets } from './scripts/vite-plugin-inline-assets.mjs';

export default defineConfig({
  // The HTML report inlines its fonts; tests must see what the builds ship.
  plugins: [inlineAssets()],
  // `ui/` imports shared code through @core, the same alias vite.web.config.ts
  // and electron-vite.config.ts define. Without it here, any test that reaches
  // a ui/ module fails to resolve — which is the seam the cross-surface
  // verdict contract test needs.
  resolve: {
    alias: { '@core': resolve(__dirname, 'src') },
  },
  test: {
    // `ui/` is included so the renderer's own checks run with the suite; it
    // holds source-level assertions (no raw HTML injection), not DOM tests,
    // so the node environment is still the right one.
    include: ['src/**/*.test.ts', 'ui/**/*.test.ts'],
    environment: 'node',
    globals: false,
    testTimeout: 10000,
  },
});
