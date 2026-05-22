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

export interface FireProjectAssetPath {
  packagePath: string
  sourcePath: string
}

export interface SaveFireProjectPayload {
  metadata: unknown
  project: unknown
  assetPaths?: FireProjectAssetPath[]
  suggestedFileName?: string
}

export interface SaveFireProjectCanceledResult {
  canceled: true
}

export interface SaveFireProjectSuccessResult {
  canceled: false
  filePath: string
}

export type SaveFireProjectResult = SaveFireProjectCanceledResult | SaveFireProjectSuccessResult

export interface OpenFireProjectCanceledResult {
  canceled: true
}

export interface OpenFireProjectSuccessResult {
  canceled: false
  filePath: string
  metadata: unknown
  project: unknown
  extractedAssetRoot: string
}

export type OpenFireProjectResult = OpenFireProjectCanceledResult | OpenFireProjectSuccessResult

export interface ImportDrawingOptions {
  pdfPage?: number
}

export interface ImportedDrawingAsset {
  id: string
  kind: 'map'
  name: string
  packagePath: string
  runtimePath: string
  mimeType: string
  mapWidth?: number
  mapHeight?: number
  sourcePath: string
  sourcePage?: number
}

export interface ImportDrawingCanceledResult {
  canceled: true
}

export interface ImportDrawingSuccessResult {
  canceled: false
  asset: ImportedDrawingAsset
}

export type ImportDrawingResult = ImportDrawingCanceledResult | ImportDrawingSuccessResult

export interface FireApi {
  importCpd: () => Promise<ImportCpdResult>
  saveFireProject: (projectPayload: SaveFireProjectPayload) => Promise<SaveFireProjectResult>
  openFireProject: () => Promise<OpenFireProjectResult>
  importDrawing: (options?: ImportDrawingOptions) => Promise<ImportDrawingResult>
}

export const fireApi: FireApi = {
  importCpd: () => ipcRenderer.invoke('fire:select-and-import-cpd') as Promise<ImportCpdResult>,
  saveFireProject: (projectPayload) =>
    ipcRenderer.invoke(
      'fire:save-project-package',
      projectPayload
    ) as Promise<SaveFireProjectResult>,
  openFireProject: () =>
    ipcRenderer.invoke('fire:open-project-package') as Promise<OpenFireProjectResult>,
  importDrawing: (options) =>
    ipcRenderer.invoke('fire:select-and-import-drawing', options) as Promise<ImportDrawingResult>
}
