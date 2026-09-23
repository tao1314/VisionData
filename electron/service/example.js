'use strict';

module.exports = {
  /** 原样返回载荷，验证主进程与渲染进程通信。 */
  ping(payload = {}) {
    return {
      ok: true,
      message: 'pong',
      payload,
      time: new Date().toISOString()
    };
  }
};
