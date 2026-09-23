'use strict';

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

/** 获取当前运行环境的完整配置。 */
function getConfig() {
  const env = process.env.APP_ENV === 'prod' ? 'prod' : 'local';
  const environmentConfig = require(`./config.${env}`);
  return merge(defaults, environmentConfig);
}

module.exports = { getConfig };
