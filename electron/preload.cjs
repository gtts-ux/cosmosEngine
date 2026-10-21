const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('cosmos', Object.freeze({
  settings: {
    load: () => ipcRenderer.invoke('settings:load'),
    save: (settings) => ipcRenderer.invoke('settings:save', settings),
  },
  catalog: () => ipcRenderer.invoke('celestial:catalog'),
  texture: (name) => ipcRenderer.invoke('texture:resolve', name),
  window: (action) => ipcRenderer.invoke('window:action', action),
  version: () => ipcRenderer.invoke('app:version'),
}));
