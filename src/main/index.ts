import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { basename, join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import fs from 'fs/promises'
import { importCpdFile } from './cpdImport'
import { importDrawingFile } from './drawingImport'
import { readFireProjectPackage, writeFireProjectPackage } from './fireProjectPackage'

let mainWindow: BrowserWindow | null = null

type MainLogLevel = 'info' | 'warn' | 'error' | 'success'

function sendLogToRenderer(message: string, level: MainLogLevel = 'info', details?: unknown): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('system-log', {
      message,
      level,
      source: 'Main',
      details
    })
  }
}

// --- IPC Core Logic ---

// [English] Log to terminal handler
ipcMain.on('log-to-terminal', (_event, { level, message, details }) => {
  const timestamp = new Date().toLocaleTimeString()
  const detailStr = details ? JSON.stringify(details) : ''

  switch (level) {
    case 'error':
      console.error(`\x1b[31m[RENDERER-ERR] ${timestamp} ${message}\x1b[0m`, detailStr)
      break
    case 'warn':
      console.warn(`\x1b[33m[RENDERER-WARN] ${timestamp} ${message}\x1b[0m`, detailStr)
      break
    case 'success':
      console.log(`\x1b[32m[RENDERER-OK] ${timestamp} ${message}\x1b[0m`, detailStr)
      break
    default:
      console.log(`[RENDERER-INFO] ${timestamp} ${message}`, detailStr)
  }
})

// 1. Save Project
ipcMain.handle('save-project', async (_event, content: string, existingPath?: string) => {
  console.log('[Main] Received save-project request. ExistingPath:', existingPath)

  if (!mainWindow) return { success: false, message: 'Window not found' }

  let targetPath = existingPath

  // 只有当路径不存在（新文件）或者传参强制要求（虽然目前逻辑没传）时才弹窗
  if (!targetPath || targetPath === '') {
    console.log('[Main] No target path provided, showing save dialog...')
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Save Project File',
      defaultPath: 'my-fire-project.json',
      filters: [{ name: 'JSON Project', extensions: ['json'] }]
    })

    if (canceled || !filePath) return { success: false, message: 'Canceled' }
    targetPath = filePath
  }

  try {
    await fs.writeFile(targetPath, content, 'utf-8')
    console.log('[Main] File successfully saved to:', targetPath)
    sendLogToRenderer(`Project saved to: ${targetPath}`, 'success')
    return { success: true, filePath: targetPath }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[Main] Save error:', message)
    sendLogToRenderer(`Save failed: ${message}`, 'error')
    return { success: false, message }
  }
})

// 2. Open Project
ipcMain.handle('open-project', async () => {
  if (!mainWindow) return null

  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Open Project File',
    filters: [{ name: 'JSON Project', extensions: ['json'] }],
    properties: ['openFile']
  })

  if (canceled || filePaths.length === 0) return null

  try {
    const filePath = filePaths[0]
    const content = await fs.readFile(filePath, 'utf-8')
    sendLogToRenderer(`Project file loaded: ${filePath}`, 'success')
    return { content, filePath }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    sendLogToRenderer(`Load failed: ${message}`, 'error')
    return null
  }
})

function getDefaultCpdExtractorDir(): string {
  return join(app.getAppPath(), '..', 'CpdExtractorPortable')
}

function getCpdImportTempDir(): string {
  return join(app.getPath('temp'), 'numens-fire-alarm-simulator', 'cpd-imports')
}

// 3. Select and import CPD through the main-process extractor boundary.
ipcMain.handle('fire:select-and-import-cpd', async () => {
  if (!mainWindow) {
    throw new Error('Window not found')
  }

  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Import CPD File',
    filters: [{ name: 'CPD Configuration', extensions: ['cpd'] }],
    properties: ['openFile']
  })

  if (canceled || filePaths.length === 0) {
    return { canceled: true }
  }

  const sourcePath = filePaths[0]
  const result = await importCpdFile({
    cpdPath: sourcePath,
    extractorDir: getDefaultCpdExtractorDir(),
    tempDir: getCpdImportTempDir()
  })

  try {
    const data = JSON.parse(result.content)
    sendLogToRenderer(`CPD imported: ${sourcePath}`, 'success')

    return {
      canceled: false,
      sourcePath,
      sourceFileName: basename(sourcePath),
      jsonPath: result.jsonPath,
      content: result.content,
      data
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`CPD extractor produced JSON that could not be parsed: ${message}`)
  }
})

// 4. Save a complete .fireproj package.
ipcMain.handle('fire:save-project-package', async (_event, payload) => {
  if (!mainWindow) {
    throw new Error('Window not found')
  }

  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Save Fire Project',
    defaultPath: payload?.suggestedFileName || 'my-fire-project.fireproj',
    filters: [{ name: 'Fire Project', extensions: ['fireproj'] }]
  })

  if (canceled || !filePath) {
    return { canceled: true }
  }

  await writeFireProjectPackage({
    targetPath: filePath,
    metadata: payload?.metadata,
    project: payload?.project,
    assetPaths: payload?.assetPaths ?? []
  })

  sendLogToRenderer(`Fire project saved: ${filePath}`, 'success')
  return { canceled: false, filePath }
})

// 5. Open a complete .fireproj package.
ipcMain.handle('fire:open-project-package', async () => {
  if (!mainWindow) {
    throw new Error('Window not found')
  }

  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Open Fire Project',
    filters: [{ name: 'Fire Project', extensions: ['fireproj'] }],
    properties: ['openFile']
  })

  if (canceled || filePaths.length === 0) {
    return { canceled: true }
  }

  const filePath = filePaths[0]
  const result = await readFireProjectPackage(filePath)

  sendLogToRenderer(`Fire project opened: ${filePath}`, 'success')
  return {
    canceled: false,
    filePath,
    ...result
  }
})

// 6. Import a map drawing asset for the fire planning workspace.
ipcMain.handle('fire:select-and-import-drawing', async (_event, options?: { pdfPage?: number }) => {
  if (!mainWindow) {
    throw new Error('Window not found')
  }

  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Import Drawing',
    filters: [
      { name: 'Drawings', extensions: ['png', 'jpg', 'jpeg', 'svg', 'pdf'] },
      { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'svg'] },
      { name: 'PDF', extensions: ['pdf'] }
    ],
    properties: ['openFile']
  })

  if (canceled || filePaths.length === 0) {
    return { canceled: true }
  }

  const asset = await importDrawingFile({
    sourcePath: filePaths[0],
    pdfPage: options?.pdfPage
  })

  sendLogToRenderer(`Drawing imported: ${asset.name}`, 'success')
  return { canceled: false, asset }
})

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
    mainWindow?.webContents.openDevTools()
    sendLogToRenderer('Main Process Ready (DevTools Enabled)', 'success')
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.electron')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
