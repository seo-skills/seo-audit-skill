/**
 * Electron Main Process Entry Point
 *
 * Creates the BrowserWindow and registers IPC handlers that bridge
 * the existing Node.js audit engine to the React renderer.
 */

import { app, BrowserWindow, nativeImage } from 'electron';
import { existsSync } from 'fs';
import { join } from 'path';
import { registerAuditHandlers } from './audit-bridge.js';
import { registerDbHandlers } from './db-bridge.js';

let mainWindow: BrowserWindow | null = null;

/**
 * The brand icon, for development runs only.
 *
 * A packaged build takes its icon from the app bundle that electron-builder
 * stamps from `electron/resources/icon.png`, and `electron/**` is excluded
 * from the shipped files — so this path exists only when running from source.
 * Without it `npm run electron:dev` shows the default Electron atom.
 */
function devBrandIcon(): Electron.NativeImage | undefined {
  const iconPath = join(__dirname, '../../electron/resources/icon.png');
  if (!existsSync(iconPath)) return undefined;
  const image = nativeImage.createFromPath(iconPath);
  return image.isEmpty() ? undefined : image;
}

function createWindow(): void {
  const devIcon = devBrandIcon();

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    title: 'SEOmator',
    // Windows and Linux read the window icon at runtime; macOS uses the bundle.
    ...(devIcon && { icon: devIcon }),
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
  // macOS shows the Dock icon from the bundle once packaged; in a source run
  // there is no bundle, so set it explicitly.
  const devIcon = devBrandIcon();
  if (devIcon && app.dock) app.dock.setIcon(devIcon);

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
