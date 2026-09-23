'use strict';

const { ipcMain } = require('electron');
const appController = require('../controller/app');
const exampleController = require('../controller/example');
const recognitionController = require('../controller/recognition');
const osController = require('../controller/os');

const handlers = {
  'app:get-info': appController.getInfo,
  'example:ping': exampleController.ping,
  'recognition:select-images': recognitionController.selectImages,
  'recognition:run': recognitionController.run,
  'window:minimize': osController.minimize,
  'window:toggle-maximize': osController.toggleMaximize,
  'window:close': osController.close
};

/** 注册渲染进程可调用的白名单 IPC 通道。 */
function registerIpcHandlers() {
  for (const [channel, handler] of Object.entries(handlers)) {
    ipcMain.handle(channel, (event, ...args) => handler(...args, event));
  }
}

module.exports = { registerIpcHandlers };
