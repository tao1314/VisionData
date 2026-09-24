'use strict';

const { app } = require('electron');
const defaults = require('./config.default');

/** 合并基础配置与当前环境配置。 */
function merge(base, override) {
  const result = { ...base };
  for (const [key, value] of Object.entries(override)) {
    result[key] = value && typeof value === 'object' && !Array.isArray(value)
      ? merge(base[key] || {}, value)
      : value;
  }
  return result;
}

/** 判断当前是否应使用打包后的生产配置。 */
function isProduction() {
  return app.isPackaged || process.env.APP_ENV === 'prod';
}

/** 获取当前运行环境的完整配置。 */
function getConfig() {
  const env = isProduction() ? 'prod' : 'local';
  const environmentConfig = require(`./config.${env}`);
  return merge(defaults, environmentConfig);
}

module.exports = { getConfig, isProduction };
