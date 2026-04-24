const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('node:path');
const { startBackend, stopBackend, getBackendInfo } = require('./backend-sidecar.cjs');
const clipboardWatcher = require('./clipboard-watcher.cjs');
const tray = require('./tray.cjs');

const isDev = process.env.ODM_DEV === '1';
let mainWindow = null;
let quitting = false;

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

  mainWindow.on('close', (e) => {
    if (!quitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(async () => {
  if (!isDev) {
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
  stopBackend();
});
