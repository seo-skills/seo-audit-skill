import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// @ts-expect-error -- plain .mjs plugin, no types needed
import { designTokens } from './scripts/vite-plugin-tokens.mjs';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';

/**
 * The dashboard build.
 *
 * Same `ui/` sources as the desktop app, emitted into `dist/web` so the CLI
 * can serve them and `files: ["dist"]` ships them to npm. Assets are hashed
 * and served with a one-year cache; index.html is never cached.
 */
export default defineConfig({
  root: resolve(__dirname, 'ui'),
  base: '/',
  plugins: [designTokens(), react(), tailwindcss()],
  resolve: {
    alias: {
      '@renderer': resolve(__dirname, 'ui'),
      '@core': resolve(__dirname, 'src'),
    },
  },
  build: {
    outDir: resolve(__dirname, 'dist/web'),
    emptyOutDir: true,
    // No source map: it is 1.5 MB, it ships to every npm user, and nobody
    // debugs the dashboard bundle from an installed package. Build from a
    // checkout when you need one.
    sourcemap: false,
    rollupOptions: {
      input: resolve(__dirname, 'ui/index.html'),
    },
  },
  server: {
    port: 7361,
    // The dev server proxies to the real API, so the browser sees one origin
    // and the same-origin checks hold exactly as they do in production.
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:7360',
        changeOrigin: false,
      },
    },
  },
});
