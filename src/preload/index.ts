import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// 自定义 API 定义
const api = {
  // 监听日志
  onSystemLog: (callback: (log: any) => void) => ipcRenderer.on('system-log', (_event, log) => callback(log)),
  
  // 保存项目 (返回 Promise)
  saveProject: (content: string) => ipcRenderer.invoke('save-project', content),
  
  // 打开项目 (返回 Promise)
  openProject: () => ipcRenderer.invoke('open-project')
}

// 暴露给渲染进程
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore
  window.electron = electronAPI
  // @ts-ignore
  window.api = api
}