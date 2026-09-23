/** 返回仅桌面端能力不可用的明确错误。 */
const unavailable = () => Promise.reject(new Error('Electron API 仅在桌面客户端中可用'));

const electron = window.electronAPI;

export const appApi = {
  getInfo: electron?.app?.getInfo || unavailable,
  ping: electron?.app?.ping || unavailable
};

export const recognitionApi = {
  selectImages: electron?.recognition?.selectImages || unavailable,
  run: electron?.recognition?.run || unavailable
};

export const windowApi = {
  minimize: electron?.window?.minimize || unavailable,
  toggleMaximize: electron?.window?.toggleMaximize || unavailable,
  close: electron?.window?.close || unavailable
};
