'use strict';

/** 在 Electron ready 前注册启动参数。 */
function beforeReady() {}

/** 处理应用就绪后的全局任务。 */
function ready() {
  console.info('[lifecycle] electron app ready');
}

/** 在退出前释放后续业务可能注册的资源。 */
function beforeQuit() {
  console.info('[lifecycle] electron app before quit');
}

module.exports = { beforeReady, ready, beforeQuit };
