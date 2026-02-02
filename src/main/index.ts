import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import fs from 'fs/promises' // 使用 Promise 版本的 fs

let mainWindow: BrowserWindow | null = null

// --- 辅助函数：发送日志到前端 ---
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

// --- IPC 核心业务逻辑 ---

// 1. 保存项目
ipcMain.handle('save-project', async (_event, content: string) => {
  if (!mainWindow) return { success: false, message: 'Window not found' }
  
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: '保存项目文件',
    defaultPath: 'my-fire-project.json',
    filters: [{ name: 'JSON Project', extensions: ['json'] }]
  })

  if (canceled || !filePath) return { success: false, message: 'Canceled' }

  try {
    await fs.writeFile(filePath, content, 'utf-8')
    sendLogToRenderer(`项目已保存至: ${filePath}`, 'success')
    return { success: true, filePath }
  } catch (error: any) {
    sendLogToRenderer(`保存失败: ${error.message}`, 'error')
    return { success: false, message: error.message }
  }
})

// 2. 打开项目
ipcMain.handle('open-project', async () => {
  if (!mainWindow) return null
  
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: '打开项目文件',
    filters: [{ name: 'JSON Project', extensions: ['json'] }],
    properties: ['openFile']
  })

  if (canceled || filePaths.length === 0) return null

  try {
    const filePath = filePaths[0]
    const content = await fs.readFile(filePath, 'utf-8')
    sendLogToRenderer(`已读取项目文件: ${filePath}`, 'success')
    return { content, filePath }
  } catch (error: any) {
    sendLogToRenderer(`读取失败: ${error.message}`, 'error')
    return null
  }
})

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    autoHideMenuBar: true, // 隐藏默认菜单栏
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
    sendLogToRenderer('主进程已就绪 (File System Ready)', 'success')
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