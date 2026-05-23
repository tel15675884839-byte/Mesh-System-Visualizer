import { describe, expect, it } from 'vitest'
import type { FireProjectDocument } from '../../../stores/fireProjectStore'
import { resolveOpenedProjectAssetRuntimePaths } from '../projectAssets'

describe('project asset runtime paths', () => {
  it('uses extracted package assets instead of stale saved runtime paths', () => {
    const project = makeProjectWithAsset({
      id: 'map-1',
      kind: 'map',
      name: 'floor.png',
      packagePath: 'assets/maps/floor.png',
      runtimePath: 'C:\\old-machine\\fire-assets\\maps\\floor.png'
    })

    const resolved = resolveOpenedProjectAssetRuntimePaths(project, 'D:\\Temp\\opened-fireproj')

    expect(resolved.assets[0].runtimePath).toBe(
      'D:\\Temp\\opened-fireproj\\assets\\maps\\floor.png'
    )
  })

  it('preserves non-package runtime paths', () => {
    const project = makeProjectWithAsset({
      id: 'external-1',
      kind: 'map',
      name: 'external.png',
      packagePath: 'external.png',
      runtimePath: 'C:\\maps\\external.png'
    })

    const resolved = resolveOpenedProjectAssetRuntimePaths(project, 'D:\\Temp\\opened-fireproj')

    expect(resolved.assets[0].runtimePath).toBe('C:\\maps\\external.png')
  })
})

function makeProjectWithAsset(asset: FireProjectDocument['assets'][number]): FireProjectDocument {
  return {
    schemaVersion: 1,
    projectId: 'project-1',
    name: 'Project',
    createdAt: 1,
    updatedAt: 1,
    language: 'en',
    networks: [],
    buildings: [],
    assets: [asset],
    viewSettings: {
      deviceIconScale2D: 1,
      deviceIconScale3D: 1,
      mapOpacity: 1,
      labelColor: '#111827',
      showLoopLines: true,
      showGroupHelperLines: true
    },
    simulationSettings: {
      timeScale: 1,
      soundEnabled: true
    },
    devices: [],
    issues: [],
    nonAddressableSounderPoints: []
  }
}
