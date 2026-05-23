import type { FireAsset } from './types'

const FIRE_ASSET_SCHEME = 'fire-asset'

export function resolveOpenedProjectAssetRuntimePaths<T extends { assets: FireAsset[] }>(
  openedProject: T,
  extractedAssetRoot: string
): T {
  return {
    ...openedProject,
    assets: openedProject.assets.map((asset) => ({
      ...asset,
      runtimePath: resolveAssetRuntimePath(asset, extractedAssetRoot)
    }))
  }
}

export function getFireAssetHref(asset: FireAsset | undefined): string | undefined {
  if (!asset) {
    return undefined
  }

  if (asset.runtimePath && isLocalRuntimePath(asset.runtimePath)) {
    return `${FIRE_ASSET_SCHEME}://local/${encodeLocalAssetPath(asset.runtimePath)}`
  }

  return asset.runtimePath ?? normalizePackagePath(asset.packagePath)
}

function encodeLocalAssetPath(path: string): string {
  const bytes = new TextEncoder().encode(path)
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function isLocalRuntimePath(path: string): boolean {
  return /^[a-z]:[\\/]/i.test(path) || path.startsWith('\\\\') || path.startsWith('/')
}

function resolveAssetRuntimePath(asset: FireAsset, extractedAssetRoot: string): string | undefined {
  const packagePath = normalizePackagePath(asset.packagePath)

  if (!packagePath.startsWith('assets/')) {
    return asset.runtimePath
  }

  const root = extractedAssetRoot.replace(/[\\/]+$/, '')
  if (!root) {
    return asset.runtimePath
  }

  return `${root}\\${packagePath.replace(/\//g, '\\')}`
}

function normalizePackagePath(packagePath: string): string {
  return packagePath.replace(/\\/g, '/').replace(/^\/+/, '')
}
