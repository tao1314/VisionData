'use strict';

const windowService = require('../service/os/window');

module.exports = {
  /** 最小化主窗口。 */
  minimize() {
    windowService.minimize();
    return true;
  },
  /** 切换主窗口最大化状态。 */
  toggleMaximize() {
    return windowService.toggleMaximize();
  },
  /** 关闭主窗口。 */
  close() {
    windowService.close();
    return true;
  }
};
