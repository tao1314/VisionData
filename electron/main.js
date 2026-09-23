'use strict';

const { app, BrowserWindow } = require('electron');
const { createMainWindow } = require('./service/os/window');
const { registerIpcHandlers } = require('./preload/ipc');
const { registerJobs } = require('./jobs');
const lifecycle = require('./preload/lifecycle');

const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const window = BrowserWindow.getAllWindows()[0];
    if (!window) return;
    if (window.isMinimized()) window.restore();
    window.focus();
  });

  lifecycle.beforeReady();

  app.whenReady().then(() => {
    registerIpcHandlers();
    registerJobs();
    createMainWindow();
    lifecycle.ready();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
    });
  });

  app.on('before-quit', lifecycle.beforeQuit);
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
