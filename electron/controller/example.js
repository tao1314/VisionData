'use strict';

const exampleService = require('../service/example');

module.exports = {
  /** 提供用于验证 IPC 链路的测试入口。 */
  ping(payload) {
    return exampleService.ping(payload);
  }
};
