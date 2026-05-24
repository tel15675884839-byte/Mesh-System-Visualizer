"use strict";
const electron = require("electron");
const preload = require("@electron-toolkit/preload");
const fireApi = {
  importCpd: () => electron.ipcRenderer.invoke("fire:select-and-import-cpd"),
  saveFireProject: (projectPayload) => electron.ipcRenderer.invoke(
    "fire:save-project-package",
    projectPayload
  ),
  openFireProject: () => electron.ipcRenderer.invoke("fire:open-project-package"),
  importDrawing: (options) => electron.ipcRenderer.invoke("fire:select-and-import-drawing", options)
};
const api = {
  onSystemLog: (callback) => electron.ipcRenderer.on("system-log", (_event, log) => callback(log)),
  logToTerminal: (level, message, details) => electron.ipcRenderer.send("log-to-terminal", { level, message, details }),
  saveProject: (content, existingPath) => electron.ipcRenderer.invoke("save-project", content, existingPath),
  openProject: () => electron.ipcRenderer.invoke("open-project")
};
if (process.contextIsolated) {
  try {
    electron.contextBridge.exposeInMainWorld("electron", preload.electronAPI);
    electron.contextBridge.exposeInMainWorld("api", api);
    electron.contextBridge.exposeInMainWorld("fireApi", fireApi);
  } catch (error) {
    console.error(error);
  }
} else {
  const unsafeWindow = window;
  unsafeWindow.electron = preload.electronAPI;
  unsafeWindow.api = api;
  unsafeWindow.fireApi = fireApi;
}
