import { ElectronAPI } from '@electron-toolkit/preload'
import type { FireApi } from './fireApi'

declare global {
  interface Window {
    electron: ElectronAPI
    api: unknown
    fireApi: FireApi
  }
}
