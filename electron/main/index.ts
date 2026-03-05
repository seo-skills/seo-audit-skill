/**
 * Electron Main Process Entry Point
 *
 * Creates the BrowserWindow and registers IPC handlers that bridge
 * the existing Node.js audit engine to the React renderer.
 */

import { app, BrowserWindow } from 'electron';
import { join } from 'path';
import { registerAuditHandlers } from './audit-bridge.js';
import { registerDbHandlers } from './db-bridge.js';

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    title: 'SEOmator',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // Required for better-sqlite3 in preload chain
    },
  });

  // In dev, load the Vite dev server; in production, load the built files
  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Register IPC handlers before window creation
app.whenReady().then(() => {
  registerAuditHandlers(() => mainWindow);
  registerDbHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
