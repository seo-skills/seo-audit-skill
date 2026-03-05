/**
 * Typed wrapper around window.electronAPI exposed by the preload script.
 * Returns null when running outside Electron (e.g., plain browser on Vite dev server).
 */

import type { ElectronAPI } from '../../preload/index.js';

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export function getAPI(): ElectronAPI | null {
  return window.electronAPI ?? null;
}
