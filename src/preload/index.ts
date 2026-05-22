import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { fireApi } from './fireApi'

interface SystemLogEntry {
  message: string
  level: string
  source?: string
  details?: unknown
}

type SystemLogCallback = (log: SystemLogEntry) => void

interface LegacyApi {
  onSystemLog: (callback: SystemLogCallback) => void
  logToTerminal: (level: string, message: string, details?: unknown) => void
  saveProject: (content: string, existingPath?: string) => Promise<unknown>
  openProject: () => Promise<unknown>
}

const api = {
  onSystemLog: (callback) =>
    ipcRenderer.on('system-log', (_event, log) => callback(log as SystemLogEntry)),

  logToTerminal: (level, message, details) =>
    ipcRenderer.send('log-to-terminal', { level, message, details }),

  saveProject: (content, existingPath) => ipcRenderer.invoke('save-project', content, existingPath),

  openProject: () => ipcRenderer.invoke('open-project')
} satisfies LegacyApi

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
    contextBridge.exposeInMainWorld('fireApi', fireApi)
  } catch (error) {
    console.error(error)
  }
} else {
  const unsafeWindow = window as typeof window & {
    electron: typeof electronAPI
    api: typeof api
    fireApi: typeof fireApi
  }

  unsafeWindow.electron = electronAPI
  unsafeWindow.api = api
  unsafeWindow.fireApi = fireApi
}
