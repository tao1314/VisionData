'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  app: {
    getInfo: () => ipcRenderer.invoke('app:get-info'),
    ping: (payload) => ipcRenderer.invoke('example:ping', payload)
  },
  recognition: {
    selectImages: () => ipcRenderer.invoke('recognition:select-images'),
    run: (payload) => ipcRenderer.invoke('recognition:run', payload)
  },
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    toggleMaximize: () => ipcRenderer.invoke('window:toggle-maximize'),
    close: () => ipcRenderer.invoke('window:close')
  }
});
