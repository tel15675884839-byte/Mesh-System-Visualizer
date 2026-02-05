"use strict";
const electron = require("electron");
const preload = require("@electron-toolkit/preload");
const api = {
  // 监听后端日志
  onSystemLog: (callback) => electron.ipcRenderer.on("system-log", (_event, log) => callback(log)),
  // 发送日志到终端 (新增)
  logToTerminal: (level, message, details) => electron.ipcRenderer.send("log-to-terminal", { level, message, details }),
  // 保存项目
  saveProject: (content) => electron.ipcRenderer.invoke("save-project", content),
  // 打开项目
  openProject: () => electron.ipcRenderer.invoke("open-project")
};
if (process.contextIsolated) {
  try {
    electron.contextBridge.exposeInMainWorld("electron", preload.electronAPI);
    electron.contextBridge.exposeInMainWorld("api", api);
  } catch (error) {
    console.error(error);
  }
} else {
  window.electron = preload.electronAPI;
  window.api = api;
}
