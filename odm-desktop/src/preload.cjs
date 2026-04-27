const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('odm', {
  getBackendInfo: () => ipcRenderer.invoke('odm:getBackendInfo'),
  openFolder: (folderPath) => ipcRenderer.invoke('odm:openFolder', folderPath),
  selectFolder: (folderPath) => ipcRenderer.invoke('odm:selectFolder', folderPath),
  confirmOverwrite: (folderPath, filename) => ipcRenderer.invoke('odm:confirmOverwrite', folderPath, filename),
  onClipboardUrl: (handler) => {
    const listener = (_e, url) => handler(url);
    ipcRenderer.on('odm:urlFromClipboard', listener);
    return () => ipcRenderer.removeListener('odm:urlFromClipboard', listener);
  },
  onIncomingUrl: (handler) => {
    const listener = (_e, url) => handler(url);
    ipcRenderer.on('odm:incomingUrl', listener);
    return () => ipcRenderer.removeListener('odm:incomingUrl', listener);
  },
  onPauseAll: (handler) => {
    ipcRenderer.on('odm:pauseAll', handler);
    return () => ipcRenderer.removeListener('odm:pauseAll', handler);
  },
  onResumeAll: (handler) => {
    ipcRenderer.on('odm:resumeAll', handler);
    return () => ipcRenderer.removeListener('odm:resumeAll', handler);
  },
  onUpdateAvailable: (handler) => {
    ipcRenderer.on('odm:updateAvailable', handler);
    return () => ipcRenderer.removeListener('odm:updateAvailable', handler);
  },
});
