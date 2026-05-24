"use strict";
const electron = require("electron");
const path = require("path");
const utils = require("@electron-toolkit/utils");
const fs = require("fs/promises");
const child_process = require("child_process");
const fs$1 = require("fs");
const url = require("url");
const AdmZip = require("adm-zip");
const icon = path.join(__dirname, "../../resources/icon.png");
const MAX_CAPTURED_OUTPUT_LENGTH = 4e3;
function createOutputJsonPath(cpdPath, tempDir) {
  const sourceName = path.basename(cpdPath, path.extname(cpdPath)).replace(/[^a-z0-9._-]+/gi, "_");
  return path.join(tempDir, `${sourceName || "import"}-${Date.now()}.json`);
}
async function pathExists(path2) {
  try {
    await fs.access(path2, fs$1.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}
function getExitCodeMessage(code) {
  if (code === 0) return "CPD import completed.";
  if (code === null) return "CPD extractor stopped before returning an exit code.";
  return `CPD extractor failed with exit code ${code}.`;
}
function trimOutput(output) {
  const trimmed = output.trim();
  if (trimmed.length <= MAX_CAPTURED_OUTPUT_LENGTH) return trimmed;
  return `${trimmed.slice(0, MAX_CAPTURED_OUTPUT_LENGTH)}...`;
}
function quoteForCmd(value) {
  return `"${value.replace(/"/g, '""')}"`;
}
async function buildExtractorCommand(extractorDir, cpdPath, jsonPath) {
  const ps1Path = path.join(extractorDir, "CpdExtractor.ps1");
  if (await pathExists(ps1Path)) {
    return {
      command: "powershell.exe",
      args: [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        ps1Path,
        "-InputCpd",
        cpdPath,
        "-OutputJson",
        jsonPath
      ],
      cwd: extractorDir,
      displayName: "CpdExtractor.ps1"
    };
  }
  const cmdPath = path.join(extractorDir, "CpdExtractor.cmd");
  if (await pathExists(cmdPath)) {
    return {
      command: process.env.ComSpec || "cmd.exe",
      args: [
        "/d",
        "/s",
        "/c",
        `call ${quoteForCmd(cmdPath)} ${quoteForCmd(cpdPath)} ${quoteForCmd(jsonPath)}`
      ],
      cwd: extractorDir,
      displayName: "CpdExtractor.cmd"
    };
  }
  throw new Error(
    `CPD extractor was not found in ${extractorDir}. Expected CpdExtractor.cmd or CpdExtractor.ps1.`
  );
}
async function runExtractor(command) {
  await new Promise((resolve, reject) => {
    const child = child_process.spawn(command.command, command.args, {
      cwd: command.cwd,
      windowsHide: true
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", (error) => {
      reject(new Error(`Unable to start ${command.displayName}: ${error.message}`));
    });
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      const output = trimOutput([stderr, stdout].filter(Boolean).join("\n"));
      const suffix = output ? `

Extractor output:
${output}` : "";
      reject(new Error(`${getExitCodeMessage(code)}${suffix}`));
    });
  });
}
async function importCpdFile(args) {
  try {
    await fs.access(args.cpdPath, fs$1.constants.R_OK);
  } catch {
    throw new Error(`CPD file could not be read: ${args.cpdPath}`);
  }
  await fs.mkdir(args.tempDir, { recursive: true });
  const jsonPath = createOutputJsonPath(args.cpdPath, args.tempDir);
  const command = await buildExtractorCommand(args.extractorDir, args.cpdPath, jsonPath);
  await runExtractor(command);
  try {
    const content = await fs.readFile(jsonPath, "utf8");
    return { jsonPath, content };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`CPD extractor finished but the JSON output could not be read: ${message}`);
  }
}
const IMAGE_EXTENSIONS = /* @__PURE__ */ new Set([".png", ".jpg", ".jpeg", ".svg"]);
async function importDrawingFile(args) {
  if (!args.sourcePath) {
    throw new Error("Drawing source path is required.");
  }
  await fs.access(args.sourcePath, fs$1.constants.R_OK);
  const extension = path.extname(args.sourcePath).toLowerCase();
  const assetDir = await ensureMapAssetDir();
  if (IMAGE_EXTENSIONS.has(extension)) {
    return copyImageDrawing(args.sourcePath, assetDir, extension);
  }
  if (extension === ".pdf") {
    return renderPdfDrawing(args.sourcePath, assetDir, args.pdfPage ?? 1);
  }
  throw new Error(`Unsupported drawing format: ${extension}`);
}
async function copyImageDrawing(sourcePath, assetDir, extension) {
  const fileName = makeAssetFileName(sourcePath, extension);
  const runtimePath = path.join(assetDir, fileName);
  await fs.copyFile(sourcePath, runtimePath);
  const size = electron.nativeImage.createFromPath(runtimePath).getSize();
  return {
    id: `map-${Date.now()}`,
    kind: "map",
    name: path.basename(sourcePath),
    packagePath: `assets/maps/${fileName}`,
    runtimePath,
    mimeType: mimeTypeForExtension(extension),
    mapWidth: size.width || void 0,
    mapHeight: size.height || void 0,
    sourcePath
  };
}
async function renderPdfDrawing(sourcePath, assetDir, pdfPage) {
  const page = Math.max(1, Math.floor(pdfPage));
  const fileName = makeAssetFileName(sourcePath, ".png", `page-${page}`);
  const runtimePath = path.join(assetDir, fileName);
  const browserWindow = new electron.BrowserWindow({
    show: false,
    width: 1600,
    height: 2200,
    webPreferences: {
      plugins: true,
      sandbox: true
    }
  });
  try {
    await browserWindow.loadURL(`${url.pathToFileURL(sourcePath).toString()}#page=${page}`);
    await new Promise((resolve) => setTimeout(resolve, 1200));
    const image = await browserWindow.webContents.capturePage();
    await fs.writeFile(runtimePath, image.toPNG());
    const size = image.getSize();
    return {
      id: `map-${Date.now()}`,
      kind: "map",
      name: `${path.basename(sourcePath)} page ${page}`,
      packagePath: `assets/maps/${fileName}`,
      runtimePath,
      mimeType: "image/png",
      mapWidth: size.width || void 0,
      mapHeight: size.height || void 0,
      sourcePath,
      sourcePage: page
    };
  } finally {
    browserWindow.destroy();
  }
}
async function ensureMapAssetDir() {
  const assetDir = path.join(electron.app.getPath("userData"), "fire-assets", "maps");
  await fs.mkdir(assetDir, { recursive: true });
  return assetDir;
}
function makeAssetFileName(sourcePath, extension, suffix) {
  const baseName = path.basename(sourcePath, path.extname(sourcePath)).replace(/[^a-z0-9._-]+/gi, "-").replace(/^-+|-+$/g, "");
  const safeBaseName = baseName || "drawing";
  const safeSuffix = suffix ? `-${suffix}` : "";
  return `${safeBaseName}${safeSuffix}-${Date.now()}${extension}`;
}
function mimeTypeForExtension(extension) {
  switch (extension) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".svg":
      return "image/svg+xml";
    case ".png":
    default:
      return "image/png";
  }
}
const REQUIRED_JSON_ENTRIES = ["metadata.json", "project.json"];
const ASSET_DIRS = ["assets/maps/", "assets/icons/", "assets/audio/"];
const ALLOWED_ASSET_PREFIXES = new Set(ASSET_DIRS);
function toPackagePath(path2) {
  return path2.replace(/\\/g, "/").replace(/^\/+/, "");
}
function isCpdPath(path$1) {
  return path.extname(path$1).toLowerCase() === ".cpd";
}
function assertPackageAssetPath(packagePath) {
  const normalized = toPackagePath(packagePath);
  if (!normalized) {
    throw new Error("Asset package path is required.");
  }
  if (normalized.includes("\0")) {
    throw new Error(`Asset package path contains an invalid character: ${packagePath}`);
  }
  if (normalized.startsWith("../") || normalized.includes("/../")) {
    throw new Error(`Asset package path must stay inside the package: ${packagePath}`);
  }
  if (isCpdPath(normalized)) {
    throw new Error(`Original CPD files must not be stored in .fireproj packages: ${packagePath}`);
  }
  if (![...ALLOWED_ASSET_PREFIXES].some((prefix) => normalized.startsWith(prefix))) {
    throw new Error(
      `Asset package path must be under assets/maps/, assets/icons/, or assets/audio/: ${packagePath}`
    );
  }
  return normalized;
}
function assertExtractedPath(root, packagePath) {
  const relativePath = toPackagePath(packagePath);
  const outputPath = path.normalize(path.join(root, ...relativePath.split("/")));
  const normalizedRoot = path.normalize(root);
  if (outputPath !== normalizedRoot && !outputPath.startsWith(`${normalizedRoot}${path.sep}`)) {
    throw new Error(`Package entry would extract outside the asset root: ${packagePath}`);
  }
  return outputPath;
}
function getRequiredEntry(zip, entryName) {
  const entry = zip.getEntry(entryName);
  if (!entry || entry.isDirectory) {
    throw new Error(`Invalid .fireproj package: missing required ${entryName}.`);
  }
  return entry;
}
function parseJsonEntry(entry, entryName) {
  try {
    return JSON.parse(entry.getData().toString("utf8"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid .fireproj package: ${entryName} is not valid JSON. ${message}`);
  }
}
function stringifyJsonEntry(value, entryName) {
  const content = JSON.stringify(value, null, 2);
  if (content === void 0) {
    throw new Error(`${entryName} content is required.`);
  }
  return Buffer.from(content, "utf8");
}
function createExtractionRoot(packagePath) {
  const safeName = path.basename(packagePath, path.extname(packagePath)).replace(/[^a-z0-9._-]+/gi, "_");
  const directoryName = `${safeName || "fire-project"}-${Date.now()}`;
  return path.join(electron.app.getPath("userData"), "fireproj-assets", directoryName);
}
async function writeFireProjectPackage(args) {
  if (!args.targetPath) {
    throw new Error("Target .fireproj path is required.");
  }
  const zip = new AdmZip();
  zip.addFile("metadata.json", stringifyJsonEntry(args.metadata, "metadata.json"));
  zip.addFile("project.json", stringifyJsonEntry(args.project, "project.json"));
  for (const assetDir of ASSET_DIRS) {
    zip.addFile(assetDir, Buffer.alloc(0));
  }
  for (const asset of args.assetPaths ?? []) {
    const packagePath = assertPackageAssetPath(asset.packagePath);
    if (isCpdPath(asset.sourcePath)) {
      throw new Error(
        `Original CPD files must not be stored in .fireproj packages: ${asset.sourcePath}`
      );
    }
    await fs.access(asset.sourcePath, fs$1.constants.R_OK);
    const content = await fs.readFile(asset.sourcePath);
    zip.addFile(packagePath, content);
  }
  await fs.mkdir(path.dirname(args.targetPath), { recursive: true });
  await new Promise((resolve, reject) => {
    zip.writeZip(args.targetPath, (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}
async function readFireProjectPackage(path$1) {
  if (!path$1) {
    throw new Error(".fireproj path is required.");
  }
  await fs.access(path$1, fs$1.constants.R_OK);
  const zip = new AdmZip(path$1);
  const metadata = parseJsonEntry(
    getRequiredEntry(zip, REQUIRED_JSON_ENTRIES[0]),
    REQUIRED_JSON_ENTRIES[0]
  );
  const project = parseJsonEntry(
    getRequiredEntry(zip, REQUIRED_JSON_ENTRIES[1]),
    REQUIRED_JSON_ENTRIES[1]
  );
  const extractedAssetRoot = createExtractionRoot(path$1);
  await fs.mkdir(extractedAssetRoot, { recursive: true });
  for (const assetDir of ASSET_DIRS) {
    await fs.mkdir(path.join(extractedAssetRoot, ...assetDir.replace(/\/$/, "").split("/")), {
      recursive: true
    });
  }
  for (const entry of zip.getEntries()) {
    const entryName = toPackagePath(entry.entryName);
    if (entryName === "metadata.json" || entryName === "project.json") continue;
    if (entry.isDirectory) continue;
    if (![...ALLOWED_ASSET_PREFIXES].some((prefix) => entryName.startsWith(prefix))) {
      throw new Error(`Invalid .fireproj package: unsupported entry ${entry.entryName}.`);
    }
    if (isCpdPath(entryName)) {
      throw new Error(
        `Invalid .fireproj package: original CPD file entry is not allowed (${entryName}).`
      );
    }
    const outputPath = assertExtractedPath(extractedAssetRoot, entryName);
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, entry.getData());
  }
  return {
    metadata,
    project,
    extractedAssetRoot
  };
}
let mainWindow = null;
const FIRE_ASSET_SCHEME = "fire-asset";
electron.protocol.registerSchemesAsPrivileged([
  {
    scheme: FIRE_ASSET_SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true
    }
  }
]);
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
electron.ipcMain.handle("save-project", async (_event, content, existingPath) => {
  console.log("[Main] Received save-project request. ExistingPath:", existingPath);
  if (!mainWindow) return { success: false, message: "Window not found" };
  let targetPath = existingPath;
  if (!targetPath || targetPath === "") {
    console.log("[Main] No target path provided, showing save dialog...");
    const { canceled, filePath } = await electron.dialog.showSaveDialog(mainWindow, {
      title: "Save Project File",
      defaultPath: "my-fire-project.json",
      filters: [{ name: "JSON Project", extensions: ["json"] }]
    });
    if (canceled || !filePath) return { success: false, message: "Canceled" };
    targetPath = filePath;
  }
  try {
    await fs.writeFile(targetPath, content, "utf-8");
    console.log("[Main] File successfully saved to:", targetPath);
    sendLogToRenderer(`Project saved to: ${targetPath}`, "success");
    return { success: true, filePath: targetPath };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[Main] Save error:", message);
    sendLogToRenderer(`Save failed: ${message}`, "error");
    return { success: false, message };
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
    const message = error instanceof Error ? error.message : String(error);
    sendLogToRenderer(`Load failed: ${message}`, "error");
    return null;
  }
});
function getDefaultCpdExtractorDir() {
  return path.join(electron.app.getAppPath(), "..", "CpdExtractorPortable");
}
function getCpdImportTempDir() {
  return path.join(electron.app.getPath("temp"), "numens-fire-alarm-simulator", "cpd-imports");
}
function registerFireAssetProtocol() {
  electron.protocol.handle(FIRE_ASSET_SCHEME, async (request) => {
    try {
      const requestUrl = new URL(request.url);
      const filePath = decodeFireAssetPath(requestUrl);
      const userDataRoot = electron.app.getPath("userData");
      if (!isPathInside(filePath, userDataRoot)) {
        return new Response("Asset path is outside the application data directory.", {
          status: 403
        });
      }
      const content = await fs.readFile(filePath);
      return new Response(content, {
        headers: {
          "content-type": mimeTypeForAsset(filePath),
          "cache-control": "no-cache"
        }
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return new Response(message, { status: 404 });
    }
  });
}
function decodeFireAssetPath(requestUrl) {
  if (requestUrl.hostname !== "local") {
    throw new Error("Unsupported fire asset host.");
  }
  const encoded = requestUrl.pathname.replace(/^\/+/, "");
  if (!encoded) {
    throw new Error("Missing fire asset path.");
  }
  const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  return Buffer.from(padded, "base64").toString("utf8");
}
function isPathInside(filePath, rootPath) {
  const normalizedFilePath = path.normalize(filePath);
  const normalizedRootPath = path.normalize(rootPath);
  const comparableFilePath = process.platform === "win32" ? normalizedFilePath.toLowerCase() : normalizedFilePath;
  const comparableRootPath = process.platform === "win32" ? normalizedRootPath.toLowerCase() : normalizedRootPath;
  return comparableFilePath === comparableRootPath || comparableFilePath.startsWith(`${comparableRootPath}${path.sep}`);
}
function mimeTypeForAsset(filePath) {
  switch (path.extname(filePath).toLowerCase()) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".svg":
      return "image/svg+xml";
    case ".pdf":
      return "application/pdf";
    default:
      return "application/octet-stream";
  }
}
electron.ipcMain.handle("fire:select-and-import-cpd", async () => {
  if (!mainWindow) {
    throw new Error("Window not found");
  }
  const { canceled, filePaths } = await electron.dialog.showOpenDialog(mainWindow, {
    title: "Import CPD File",
    filters: [{ name: "CPD Configuration", extensions: ["cpd"] }],
    properties: ["openFile"]
  });
  if (canceled || filePaths.length === 0) {
    return { canceled: true };
  }
  const sourcePath = filePaths[0];
  const result = await importCpdFile({
    cpdPath: sourcePath,
    extractorDir: getDefaultCpdExtractorDir(),
    tempDir: getCpdImportTempDir()
  });
  try {
    const data = JSON.parse(result.content);
    sendLogToRenderer(`CPD imported: ${sourcePath}`, "success");
    return {
      canceled: false,
      sourcePath,
      sourceFileName: path.basename(sourcePath),
      jsonPath: result.jsonPath,
      content: result.content,
      data
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`CPD extractor produced JSON that could not be parsed: ${message}`);
  }
});
electron.ipcMain.handle("fire:save-project-package", async (_event, payload) => {
  if (!mainWindow) {
    throw new Error("Window not found");
  }
  const { canceled, filePath } = await electron.dialog.showSaveDialog(mainWindow, {
    title: "Save Fire Project",
    defaultPath: payload?.suggestedFileName || "my-fire-project.fireproj",
    filters: [{ name: "Fire Project", extensions: ["fireproj"] }]
  });
  if (canceled || !filePath) {
    return { canceled: true };
  }
  await writeFireProjectPackage({
    targetPath: filePath,
    metadata: payload?.metadata,
    project: payload?.project,
    assetPaths: payload?.assetPaths ?? []
  });
  sendLogToRenderer(`Fire project saved: ${filePath}`, "success");
  return { canceled: false, filePath };
});
electron.ipcMain.handle("fire:open-project-package", async () => {
  if (!mainWindow) {
    throw new Error("Window not found");
  }
  const { canceled, filePaths } = await electron.dialog.showOpenDialog(mainWindow, {
    title: "Open Fire Project",
    filters: [{ name: "Fire Project", extensions: ["fireproj"] }],
    properties: ["openFile"]
  });
  if (canceled || filePaths.length === 0) {
    return { canceled: true };
  }
  const filePath = filePaths[0];
  const result = await readFireProjectPackage(filePath);
  sendLogToRenderer(`Fire project opened: ${filePath}`, "success");
  return {
    canceled: false,
    filePath,
    ...result
  };
});
electron.ipcMain.handle("fire:select-and-import-drawing", async (_event, options) => {
  if (!mainWindow) {
    throw new Error("Window not found");
  }
  const { canceled, filePaths } = await electron.dialog.showOpenDialog(mainWindow, {
    title: "Import Drawing",
    filters: [
      { name: "Drawings", extensions: ["png", "jpg", "jpeg", "svg", "pdf"] },
      { name: "Images", extensions: ["png", "jpg", "jpeg", "svg"] },
      { name: "PDF", extensions: ["pdf"] }
    ],
    properties: ["openFile"]
  });
  if (canceled || filePaths.length === 0) {
    return { canceled: true };
  }
  const asset = await importDrawingFile({
    sourcePath: filePaths[0],
    pdfPage: options?.pdfPage
  });
  sendLogToRenderer(`Drawing imported: ${asset.name}`, "success");
  return { canceled: false, asset };
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
  registerFireAssetProtocol();
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
