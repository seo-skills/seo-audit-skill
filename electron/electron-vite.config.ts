import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
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
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@renderer': resolve(__dirname, '../ui'),
        '@core': resolve(__dirname, '../src'),
      },
    },
  },
});
