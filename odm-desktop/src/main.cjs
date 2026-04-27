const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('node:path');
const { startBackend, stopBackend, getBackendInfo } = require('./backend-sidecar.cjs');
const clipboardWatcher = require('./clipboard-watcher.cjs');
const tray = require('./tray.cjs');
const discoveryServer = require('./discovery-server.cjs');
const nativeHost = require('./native-host-installer.cjs');

const isDev = process.env.ODM_DEV === '1';
let mainWindow = null;
let quitting = false;
let pendingIncomingUrls = [];
const recentIncomingUrls = new Map();
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
}

function registerProtocolHandlers() {
  for (const scheme of ['odm', 'magnet']) {
    if (process.defaultApp && process.argv.length >= 2) {
      app.setAsDefaultProtocolClient(scheme, process.execPath, [path.resolve(process.argv[1])]);
    } else {
      app.setAsDefaultProtocolClient(scheme);
    }
  }
}

function focusWindow() {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function normalizeIncomingUrl(url) {
  if (typeof url !== 'string' || !url.trim()) return '';
  const trimmed = url.trim();
  if (trimmed.startsWith('odm://add?')) {
    try {
      return new URL(trimmed).searchParams.get('url') || '';
    } catch {
      return '';
    }
  }
  return trimmed;
}

function handleIncomingUrl(url) {
  const normalized = normalizeIncomingUrl(url);
  if (!normalized) return;
  if (recentIncoming(normalized)) return;
  rememberIncoming(normalized);
  if (!mainWindow) {
    pendingIncomingUrls.push(normalized);
    if (app.isReady()) createWindow();
    return;
  }
  pendingIncomingUrls.push(normalized);
  flushIncomingUrls();
}

function flushIncomingUrls() {
  if (!mainWindow || pendingIncomingUrls.length === 0) return;
  focusWindow();
  if (mainWindow.webContents.isLoading()) return;
  const pending = pendingIncomingUrls;
  pendingIncomingUrls = [];
  for (const url of pending) mainWindow.webContents.send('odm:incomingUrl', url);
}

function incomingKey(url) {
  const value = String(url || '').trim();
  const match = /xt=urn:btih:([^&]+)/i.exec(value);
  if (match) return `torrent:${match[1].toLowerCase()}`;
  return value.toLowerCase();
}

function recentIncoming(url) {
  const now = Date.now();
  for (const [key, at] of recentIncomingUrls) {
    if (now - at > 45_000) recentIncomingUrls.delete(key);
  }
  const key = incomingKey(url);
  return recentIncomingUrls.has(key);
}

function rememberIncoming(url) {
  recentIncomingUrls.set(incomingKey(url), Date.now());
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1080,
    minHeight: 680,
    title: 'ODM',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    backgroundColor: '#0a0a0c',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:4200');
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'app', 'index.html'));
  }

  mainWindow.webContents.on('did-finish-load', () => setTimeout(flushIncomingUrls, 800));

  mainWindow.on('close', (e) => {
    if (!quitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

app.on('open-url', (event, url) => {
  event.preventDefault();
  handleIncomingUrl(url);
});

app.on('second-instance', (_event, commandLine) => {
  focusWindow();
  for (const arg of commandLine) {
    if (arg.startsWith('magnet:') || arg.startsWith('odm://')) handleIncomingUrl(arg);
  }
});

if (gotTheLock) app.whenReady().then(async () => {
  registerProtocolHandlers();
  const hasExternalBackend = isDev && process.env.ODM_BACKEND_PORT && process.env.ODM_BACKEND_TOKEN;
  if (!hasExternalBackend) {
    try {
      await startBackend();
    } catch (err) {
      console.error('[ODM] backend failed to start:', err);
    }
  }

  ipcMain.handle('odm:getBackendInfo', () => getBackendInfo());
  ipcMain.handle('odm:openFolder', async (_event, folderPath) => {
    if (typeof folderPath !== 'string' || folderPath.length < 1) return;
    await shell.openPath(folderPath);
  });
  ipcMain.handle('odm:selectFolder', async (_event, folderPath) => {
    const result = await dialog.showOpenDialog(mainWindow, {
      defaultPath: typeof folderPath === 'string' && folderPath ? folderPath : undefined,
      properties: ['openDirectory', 'createDirectory'],
    });
    return result.canceled ? '' : result.filePaths[0] || '';
  });

  try {
    await discoveryServer.start(() => getBackendInfo());
  } catch (err) {
    console.warn('[ODM] discovery server failed:', err && err.message);
  }

  try {
    nativeHost.install({
      scriptPath: path.join(__dirname, 'native-host.cjs'),
      dataDir: path.join(app.getPath('userData'), 'browser-bridge'),
    });
  } catch (err) {
    console.warn('[ODM] native host install failed:', err && err.message);
  }

  createWindow();
  tray.build(mainWindow, () => { quitting = true; app.quit(); });

  clipboardWatcher.start((url) => {
    mainWindow?.webContents.send('odm:urlFromClipboard', url);
  });

  if (!isDev) require('./updater.cjs').init(mainWindow);

  app.on('activate', () => {
    if (!mainWindow) createWindow();
    else { mainWindow.show(); mainWindow.focus(); }
  });
});

app.on('before-quit', () => {
  quitting = true;
  clipboardWatcher.stop();
  tray.destroy();
  discoveryServer.stop();
  stopBackend();
});
