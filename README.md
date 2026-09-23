# VisionData（图数智取）

一个面向图片识别与结构化数据转换场景的桌面客户端。项目参考 `D:\myProject\SmartDrilling` 的主进程分层与前端目录组织，技术栈为 Electron + Vue 3 + JavaScript + Element Plus。

## 环境

- Node.js 20+
- npm 10+

## 启动

```bash
npm install
npm --prefix frontend install
npm run dev
```

## 构建

```bash
npm run build
npm run start
```

Windows 安装包：

```bash
npm run dist:win
```

## 目录说明

- `electron/config`：主进程环境配置
- `electron/controller`：IPC 控制器，只负责参数接收与结果返回
- `electron/service`：主进程业务和系统能力
- `electron/jobs`：批处理、重试等后台任务入口
- `electron/preload`：安全桥接与生命周期
- `frontend/src/api`：渲染进程 API
- `frontend/src/layouts`：整体布局
- `frontend/src/router`：路由
- `frontend/src/store`：Vuex 状态
- `frontend/src/views`：业务页面
- `cmd/builder.json`：electron-builder 打包配置
- `build/extraResources`：OCR 模型、字典和本地引擎等附加资源
- `public/images`：主进程公共图片资源

当前已搭好图片导入、识别任务入口、数据结果页与安全 IPC 通道。真正的 OCR/视觉模型将在 `electron/service/recognition` 中接入，不在界面层耦合具体供应商。

应用名称、`appId`、窗口标题可分别在根目录 `package.json`、`cmd/builder.json`、`electron/config/config.default.js` 中修改。
