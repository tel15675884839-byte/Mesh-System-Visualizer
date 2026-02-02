import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import fs from 'fs/promises'

let mainWindow: BrowserWindow | null = null

function sendLogToRenderer(message: string, level: 'info'|'warn'|'error' = 'info', details?: any) {
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
ipcMain.handle('save-project', async (_event, content: string) => {
  if (!mainWindow) return { success: false, message: 'Window not found' }
  
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Save Project File',
    defaultPath: 'my-fire-project.json',
    filters: [{ name: 'JSON Project', extensions: ['json'] }]
  })

  if (canceled || !filePath) return { success: false, message: 'Canceled' }

  try {
    await fs.writeFile(filePath, content, 'utf-8')
    sendLogToRenderer(`Project saved to: ${filePath}`, 'success')
    return { success: true, filePath }
  } catch (error: any) {
    sendLogToRenderer(`Save failed: ${error.message}`, 'error')
    return { success: false, message: error.message }
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
  } catch (error: any) {
    sendLogToRenderer(`Load failed: ${error.message}`, 'error')
    return null
  }
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