const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('freshwater', {
  onSnapshot: (cb) => ipcRenderer.on('snapshot', (_event, snapshot) => cb(snapshot)),
  openMenu: () => ipcRenderer.send('open-menu'),
  openInfo: () => ipcRenderer.send('open-info'),
});
