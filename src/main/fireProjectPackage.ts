import AdmZip from 'adm-zip'
import { app } from 'electron'
import { constants } from 'fs'
import { access, mkdir, readFile, writeFile } from 'fs/promises'
import { basename, dirname, extname, join, normalize, sep } from 'path'

export interface FireProjectAssetPath {
  packagePath: string
  sourcePath: string
}

export interface WriteFireProjectPackageArgs {
  targetPath: string
  metadata: unknown
  project: unknown
  assetPaths: FireProjectAssetPath[]
}

export interface ReadFireProjectPackageResult {
  metadata: unknown
  project: unknown
  extractedAssetRoot: string
}

const REQUIRED_JSON_ENTRIES = ['metadata.json', 'project.json'] as const
const ASSET_DIRS = ['assets/maps/', 'assets/icons/', 'assets/audio/'] as const
const ALLOWED_ASSET_PREFIXES = new Set<string>(ASSET_DIRS)

function toPackagePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\/+/, '')
}

function isCpdPath(path: string): boolean {
  return extname(path).toLowerCase() === '.cpd'
}

function assertPackageAssetPath(packagePath: string): string {
  const normalized = toPackagePath(packagePath)

  if (!normalized) {
    throw new Error('Asset package path is required.')
  }

  if (normalized.includes('\0')) {
    throw new Error(`Asset package path contains an invalid character: ${packagePath}`)
  }

  if (normalized.startsWith('../') || normalized.includes('/../')) {
    throw new Error(`Asset package path must stay inside the package: ${packagePath}`)
  }

  if (isCpdPath(normalized)) {
    throw new Error(`Original CPD files must not be stored in .fireproj packages: ${packagePath}`)
  }

  if (![...ALLOWED_ASSET_PREFIXES].some((prefix) => normalized.startsWith(prefix))) {
    throw new Error(
      `Asset package path must be under assets/maps/, assets/icons/, or assets/audio/: ${packagePath}`
    )
  }

  return normalized
}

function assertExtractedPath(root: string, packagePath: string): string {
  const relativePath = toPackagePath(packagePath)
  const outputPath = normalize(join(root, ...relativePath.split('/')))
  const normalizedRoot = normalize(root)

  if (outputPath !== normalizedRoot && !outputPath.startsWith(`${normalizedRoot}${sep}`)) {
    throw new Error(`Package entry would extract outside the asset root: ${packagePath}`)
  }

  return outputPath
}

function getRequiredEntry(zip: AdmZip, entryName: string): AdmZip.IZipEntry {
  const entry = zip.getEntry(entryName)
  if (!entry || entry.isDirectory) {
    throw new Error(`Invalid .fireproj package: missing required ${entryName}.`)
  }

  return entry
}

function parseJsonEntry(entry: AdmZip.IZipEntry, entryName: string): unknown {
  try {
    return JSON.parse(entry.getData().toString('utf8')) as unknown
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Invalid .fireproj package: ${entryName} is not valid JSON. ${message}`)
  }
}

function stringifyJsonEntry(value: unknown, entryName: string): Buffer {
  const content = JSON.stringify(value, null, 2)

  if (content === undefined) {
    throw new Error(`${entryName} content is required.`)
  }

  return Buffer.from(content, 'utf8')
}

function createExtractionRoot(packagePath: string): string {
  const safeName = basename(packagePath, extname(packagePath)).replace(/[^a-z0-9._-]+/gi, '_')
  const directoryName = `${safeName || 'fire-project'}-${Date.now()}`
  return join(app.getPath('userData'), 'fireproj-assets', directoryName)
}

export async function writeFireProjectPackage(args: WriteFireProjectPackageArgs): Promise<void> {
  if (!args.targetPath) {
    throw new Error('Target .fireproj path is required.')
  }

  const zip = new AdmZip()

  zip.addFile('metadata.json', stringifyJsonEntry(args.metadata, 'metadata.json'))
  zip.addFile('project.json', stringifyJsonEntry(args.project, 'project.json'))

  for (const assetDir of ASSET_DIRS) {
    zip.addFile(assetDir, Buffer.alloc(0))
  }

  for (const asset of args.assetPaths ?? []) {
    const packagePath = assertPackageAssetPath(asset.packagePath)

    if (isCpdPath(asset.sourcePath)) {
      throw new Error(
        `Original CPD files must not be stored in .fireproj packages: ${asset.sourcePath}`
      )
    }

    await access(asset.sourcePath, constants.R_OK)
    const content = await readFile(asset.sourcePath)
    zip.addFile(packagePath, content)
  }

  await mkdir(dirname(args.targetPath), { recursive: true })
  await new Promise<void>((resolve, reject) => {
    zip.writeZip(args.targetPath, (error) => {
      if (error) {
        reject(error)
        return
      }

      resolve()
    })
  })
}

export async function readFireProjectPackage(path: string): Promise<ReadFireProjectPackageResult> {
  if (!path) {
    throw new Error('.fireproj path is required.')
  }

  await access(path, constants.R_OK)

  const zip = new AdmZip(path)
  const metadata = parseJsonEntry(
    getRequiredEntry(zip, REQUIRED_JSON_ENTRIES[0]),
    REQUIRED_JSON_ENTRIES[0]
  )
  const project = parseJsonEntry(
    getRequiredEntry(zip, REQUIRED_JSON_ENTRIES[1]),
    REQUIRED_JSON_ENTRIES[1]
  )

  const extractedAssetRoot = createExtractionRoot(path)
  await mkdir(extractedAssetRoot, { recursive: true })

  for (const assetDir of ASSET_DIRS) {
    await mkdir(join(extractedAssetRoot, ...assetDir.replace(/\/$/, '').split('/')), { recursive: true })
  }

  for (const entry of zip.getEntries()) {
    const entryName = toPackagePath(entry.entryName)

    if (entryName === 'metadata.json' || entryName === 'project.json') continue
    if (entry.isDirectory) continue

    if (![...ALLOWED_ASSET_PREFIXES].some((prefix) => entryName.startsWith(prefix))) {
      throw new Error(`Invalid .fireproj package: unsupported entry ${entry.entryName}.`)
    }

    if (isCpdPath(entryName)) {
      throw new Error(`Invalid .fireproj package: original CPD file entry is not allowed (${entryName}).`)
    }

    const outputPath = assertExtractedPath(extractedAssetRoot, entryName)
    await mkdir(dirname(outputPath), { recursive: true })
    await writeFile(outputPath, entry.getData())
  }

  return {
    metadata,
    project,
    extractedAssetRoot
  }
}
