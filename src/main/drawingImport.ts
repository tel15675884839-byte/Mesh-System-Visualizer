import { app, BrowserWindow, nativeImage } from 'electron'
import { constants } from 'fs'
import { access, copyFile, mkdir, writeFile } from 'fs/promises'
import { basename, extname, join } from 'path'
import { pathToFileURL } from 'url'

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

export interface ImportDrawingFileArgs {
  sourcePath: string
  pdfPage?: number
}

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.svg'])

export async function importDrawingFile(
  args: ImportDrawingFileArgs
): Promise<ImportedDrawingAsset> {
  if (!args.sourcePath) {
    throw new Error('Drawing source path is required.')
  }

  await access(args.sourcePath, constants.R_OK)

  const extension = extname(args.sourcePath).toLowerCase()
  const assetDir = await ensureMapAssetDir()

  if (IMAGE_EXTENSIONS.has(extension)) {
    return copyImageDrawing(args.sourcePath, assetDir, extension)
  }

  if (extension === '.pdf') {
    return renderPdfDrawing(args.sourcePath, assetDir, args.pdfPage ?? 1)
  }

  throw new Error(`Unsupported drawing format: ${extension}`)
}

async function copyImageDrawing(
  sourcePath: string,
  assetDir: string,
  extension: string
): Promise<ImportedDrawingAsset> {
  const fileName = makeAssetFileName(sourcePath, extension)
  const runtimePath = join(assetDir, fileName)
  await copyFile(sourcePath, runtimePath)

  const size = nativeImage.createFromPath(runtimePath).getSize()

  return {
    id: `map-${Date.now()}`,
    kind: 'map',
    name: basename(sourcePath),
    packagePath: `assets/maps/${fileName}`,
    runtimePath,
    mimeType: mimeTypeForExtension(extension),
    mapWidth: size.width || undefined,
    mapHeight: size.height || undefined,
    sourcePath
  }
}

async function renderPdfDrawing(
  sourcePath: string,
  assetDir: string,
  pdfPage: number
): Promise<ImportedDrawingAsset> {
  const page = Math.max(1, Math.floor(pdfPage))
  const fileName = makeAssetFileName(sourcePath, '.png', `page-${page}`)
  const runtimePath = join(assetDir, fileName)
  const browserWindow = new BrowserWindow({
    show: false,
    width: 1600,
    height: 2200,
    webPreferences: {
      plugins: true,
      sandbox: true
    }
  })

  try {
    await browserWindow.loadURL(`${pathToFileURL(sourcePath).toString()}#page=${page}`)
    await new Promise((resolve) => setTimeout(resolve, 1200))
    const image = await browserWindow.webContents.capturePage()
    await writeFile(runtimePath, image.toPNG())
    const size = image.getSize()

    return {
      id: `map-${Date.now()}`,
      kind: 'map',
      name: `${basename(sourcePath)} page ${page}`,
      packagePath: `assets/maps/${fileName}`,
      runtimePath,
      mimeType: 'image/png',
      mapWidth: size.width || undefined,
      mapHeight: size.height || undefined,
      sourcePath,
      sourcePage: page
    }
  } finally {
    browserWindow.destroy()
  }
}

async function ensureMapAssetDir(): Promise<string> {
  const assetDir = join(app.getPath('userData'), 'fire-assets', 'maps')
  await mkdir(assetDir, { recursive: true })
  return assetDir
}

function makeAssetFileName(sourcePath: string, extension: string, suffix?: string): string {
  const baseName = basename(sourcePath, extname(sourcePath))
    .replace(/[^a-z0-9._-]+/gi, '-')
    .replace(/^-+|-+$/g, '')
  const safeBaseName = baseName || 'drawing'
  const safeSuffix = suffix ? `-${suffix}` : ''
  return `${safeBaseName}${safeSuffix}-${Date.now()}${extension}`
}

function mimeTypeForExtension(extension: string): string {
  switch (extension) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg'
    case '.svg':
      return 'image/svg+xml'
    case '.png':
    default:
      return 'image/png'
  }
}
