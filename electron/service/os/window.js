'use strict';

const path = require('path');
const { BrowserWindow } = require('electron');
const { getConfig } = require('../../config');

let mainWindow = null;

/** 获取仍处于可用状态的主窗口。 */
function getMainWindow() {
  return mainWindow && !mainWindow.isDestroyed() ? mainWindow : null;
}

/** 根据运行环境创建并加载主窗口。 */
function createMainWindow() {
  const config = getConfig();
  mainWindow = new BrowserWindow(config.window);
  mainWindow.setMenuBarVisibility(false);

  if (process.env.APP_ENV === 'prod') {
    mainWindow.loadFile(path.join(__dirname, '..', '..', '..', 'frontend', 'dist', 'index.html'));
  } else {
    mainWindow.loadURL(config.devServerUrl);
  }

  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  if (config.openDevTools) mainWindow.webContents.openDevTools({ mode: 'detach' });
  return mainWindow;
}

/** 最小化主窗口。 */
function minimize() {
  getMainWindow()?.minimize();
}

/** 在最大化和还原状态之间切换。 */
function toggleMaximize() {
  const window = getMainWindow();
  if (!window) return false;
  window.isMaximized() ? window.unmaximize() : window.maximize();
  return window.isMaximized();
}

/** 关闭主窗口。 */
function close() {
  getMainWindow()?.close();
}

module.exports = { createMainWindow, getMainWindow, minimize, toggleMaximize, close };
