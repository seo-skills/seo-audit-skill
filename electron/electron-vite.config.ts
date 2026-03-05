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
  renderer: {
    root: resolve(__dirname, 'renderer'),
    build: {
      outDir: resolve(__dirname, '../dist-electron/renderer'),
      rollupOptions: {
        input: resolve(__dirname, 'renderer/index.html'),
      },
    },
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@renderer': resolve(__dirname, 'renderer'),
      },
    },
  },
});
