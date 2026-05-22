import { ipcRenderer } from 'electron'

export interface ImportCpdCanceledResult {
  canceled: true
}

export interface ImportCpdSuccessResult {
  canceled: false
  sourcePath: string
  sourceFileName: string
  jsonPath: string
  content: string
  data: unknown
}

export type ImportCpdResult = ImportCpdCanceledResult | ImportCpdSuccessResult

export interface FireApi {
  importCpd: () => Promise<ImportCpdResult>
}

export const fireApi: FireApi = {
  importCpd: () => ipcRenderer.invoke('fire:select-and-import-cpd') as Promise<ImportCpdResult>
}
