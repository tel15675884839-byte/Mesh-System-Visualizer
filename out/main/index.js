"use strict";
const electron = require("electron");
const path = require("path");
const utils = require("@electron-toolkit/utils");
const fs = require("fs/promises");
const icon = path.join(__dirname, "../../resources/icon.png");
let mainWindow = null;
function sendLogToRenderer(message, level = "info", details) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("system-log", {
      message,
      level,
      source: "Main",
      details
    });
  }
}
electron.ipcMain.on("log-to-terminal", (_event, { level, message, details }) => {
  const timestamp = (/* @__PURE__ */ new Date()).toLocaleTimeString();
  const detailStr = details ? JSON.stringify(details) : "";
  switch (level) {
    case "error":
      console.error(`\x1B[31m[RENDERER-ERR] ${timestamp} ${message}\x1B[0m`, detailStr);
      break;
    case "warn":
      console.warn(`\x1B[33m[RENDERER-WARN] ${timestamp} ${message}\x1B[0m`, detailStr);
      break;
    case "success":
      console.log(`\x1B[32m[RENDERER-OK] ${timestamp} ${message}\x1B[0m`, detailStr);
      break;
    default:
      console.log(`[RENDERER-INFO] ${timestamp} ${message}`, detailStr);
  }
});
electron.ipcMain.handle("save-project", async (_event, content) => {
  if (!mainWindow) return { success: false, message: "Window not found" };
  const { canceled, filePath } = await electron.dialog.showSaveDialog(mainWindow, {
    title: "Save Project File",
    defaultPath: "my-fire-project.json",
    filters: [{ name: "JSON Project", extensions: ["json"] }]
  });
  if (canceled || !filePath) return { success: false, message: "Canceled" };
  try {
    await fs.writeFile(filePath, content, "utf-8");
    sendLogToRenderer(`Project saved to: ${filePath}`, "success");
    return { success: true, filePath };
  } catch (error) {
    sendLogToRenderer(`Save failed: ${error.message}`, "error");
    return { success: false, message: error.message };
  }
});
electron.ipcMain.handle("open-project", async () => {
  if (!mainWindow) return null;
  const { canceled, filePaths } = await electron.dialog.showOpenDialog(mainWindow, {
    title: "Open Project File",
    filters: [{ name: "JSON Project", extensions: ["json"] }],
    properties: ["openFile"]
  });
  if (canceled || filePaths.length === 0) return null;
  try {
    const filePath = filePaths[0];
    const content = await fs.readFile(filePath, "utf-8");
    sendLogToRenderer(`Project file loaded: ${filePath}`, "success");
    return { content, filePath };
  } catch (error) {
    sendLogToRenderer(`Load failed: ${error.message}`, "error");
    return null;
  }
});
function createWindow() {
  mainWindow = new electron.BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    ...process.platform === "linux" ? { icon } : {},
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      sandbox: false
    }
  });
  mainWindow.on("ready-to-show", () => {
    mainWindow?.show();
    mainWindow?.webContents.openDevTools();
    sendLogToRenderer("Main Process Ready (DevTools Enabled)", "success");
  });
  mainWindow.webContents.setWindowOpenHandler((details) => {
    electron.shell.openExternal(details.url);
    return { action: "deny" };
  });
  if (utils.is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
}
electron.app.whenReady().then(() => {
  utils.electronApp.setAppUserModelId("com.electron");
  electron.app.on("browser-window-created", (_, window) => {
    utils.optimizer.watchWindowShortcuts(window);
  });
  createWindow();
  electron.app.on("activate", function() {
    if (electron.BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    electron.app.quit();
  }
});
