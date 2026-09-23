'use strict';

/** 图片导入、预览数据生成与识别引擎适配服务。 */

const path = require('path');
const fs = require('fs/promises');
const { dialog } = require('electron');

const IMAGE_FILTERS = [
  { name: '图片文件', extensions: ['png', 'jpg', 'jpeg', 'bmp', 'webp', 'tif', 'tiff'] }
];

const MIME_TYPES = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.bmp': 'image/bmp',
  '.webp': 'image/webp',
  '.tif': 'image/tiff',
  '.tiff': 'image/tiff'
};

/** 将本地图片转换为渲染进程可安全显示的数据地址。 */
async function createImageInfo(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  const buffer = await fs.readFile(filePath);
  return {
    name: path.basename(filePath),
    path: filePath,
    dataUrl: `data:${MIME_TYPES[extension] || 'application/octet-stream'};base64,${buffer.toString('base64')}`,
    status: 'pending'
  };
}

/** 让用户从本地选择待识别图片。 */
async function selectImages() {
  const result = await dialog.showOpenDialog({
    title: '选择待识别图片',
    properties: ['openFile', 'multiSelections'],
    filters: IMAGE_FILTERS
  });

  if (result.canceled) return [];
  return Promise.all(result.filePaths.map(createImageInfo));
}

/**
 * 执行识别任务。
 * 后续在此接入本地 OCR、Python 服务或远程视觉模型，保持 Controller 和 UI 不变。
 */
async function run(payload = {}) {
  const images = Array.isArray(payload.images) ? payload.images : [];
  if (!images.length) throw new Error('请先选择至少一张图片');

  return {
    taskId: `task-${Date.now()}`,
    status: 'engine-not-configured',
    message: '项目骨架已就绪，请在 electron/service/recognition 中接入识别引擎',
    rows: []
  };
}

module.exports = { selectImages, run };
