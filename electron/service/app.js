'use strict';

const { app } = require('electron');

module.exports = {
  /** 汇总关于页面所需的运行时版本信息。 */
  getInfo() {
    return {
      name: app.getName(),
      version: app.getVersion(),
      platform: process.platform,
      electron: process.versions.electron,
      node: process.versions.node
    };
  }
};
