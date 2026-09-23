'use strict';

const recognitionService = require('../service/recognition');

module.exports = {
  /** 打开系统文件选择器并返回图片信息。 */
  selectImages() {
    return recognitionService.selectImages();
  },
  /** 创建一次图片识别任务。 */
  run(payload) {
    return recognitionService.run(payload);
  }
};
