const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('odm', {
  getBackendInfo: () => ipcRenderer.invoke('odm:getBackendInfo'),
  openFolder: (folderPath) => ipcRenderer.invoke('odm:openFolder', folderPath),
  onClipboardUrl: (handler) => {
    const listener = (_e, url) => handler(url);
    ipcRenderer.on('odm:urlFromClipboard', listener);
    return () => ipcRenderer.removeListener('odm:urlFromClipboard', listener);
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
