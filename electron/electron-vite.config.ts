import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
// @ts-expect-error -- plain .mjs plugin, no types needed
import { designTokens } from '../scripts/vite-plugin-tokens.mjs';
// @ts-expect-error -- plain .mjs plugin, no types needed
import { inlineAssets } from '../scripts/vite-plugin-inline-assets.mjs';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';
import { realpathSync } from 'fs';
import { searchForWorkspaceRoot } from 'vite';

export default defineConfig({
  main: {
    // The main process renders the HTML report, which carries its fonts inline
    plugins: [externalizeDepsPlugin(), inlineAssets()],
    build: {
      outDir: 'dist-electron/main',
      rollupOptions: {
        input: resolve(__dirname, 'main/index.ts'),
      },
    },
    resolve: {
      alias: {
        '@core': resolve(__dirname, '../src'),
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'dist-electron/preload',
      rollupOptions: {
        input: resolve(__dirname, 'preload/index.ts'),
      },
    },
  },
  // The renderer lives in `ui/`, outside `electron/`, because the web
  // dashboard serves the same React app. Electron is one host of it, not its
  // owner.
  renderer: {
    root: resolve(__dirname, '../ui'),
    build: {
      outDir: resolve(__dirname, '../dist-electron/renderer'),
      rollupOptions: {
        input: resolve(__dirname, '../ui/index.html'),
      },
    },
    plugins: [designTokens(), react(), tailwindcss()],
    server: {
      fs: {
        // A git worktree often links node_modules from the main checkout; the
        // bundled fonts then resolve outside the worktree and Vite refuses them.
        // The real path is the same directory in an ordinary checkout.
        allow: [searchForWorkspaceRoot(process.cwd()), realpathSync(resolve(__dirname, '../node_modules'))],
      },
    },
    resolve: {
      alias: {
        '@renderer': resolve(__dirname, '../ui'),
        '@core': resolve(__dirname, '../src'),
      },
    },
  },
});
