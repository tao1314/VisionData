'use strict';

const path = require('path');

module.exports = {
  devServerUrl: 'http://127.0.0.1:10286',
  window: {
    title: 'VisionData 图数智取',
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    frame: false,
    show: false,
    backgroundColor: '#f4f7fb',
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'bridge.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  }
};
