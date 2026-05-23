import type { FireAsset } from './types'

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
