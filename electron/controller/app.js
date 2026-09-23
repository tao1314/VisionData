'use strict';

const appService = require('../service/app');

module.exports = {
  /** 返回桌面应用运行时信息。 */
  getInfo() {
    return appService.getInfo();
  }
};
