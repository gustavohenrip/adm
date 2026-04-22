const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('adm', {
  getBackendInfo: () => ipcRenderer.invoke('adm:getBackendInfo'),
});
