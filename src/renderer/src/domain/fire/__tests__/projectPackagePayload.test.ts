import { describe, expect, it } from 'vitest'
import { reactive } from 'vue'
import type { FireProject } from '../types'
import { createFireProjectSavePayload } from '../projectPackagePayload'

describe('project package payload', () => {
  it('creates a plain cloneable save payload from a reactive project', () => {
    const project = reactive(makeProject())
    const payload = createFireProjectSavePayload(project, new Date('2026-05-23T12:00:00.000Z'))

    expect(() => structuredClone(payload)).not.toThrow()
    expect(payload.metadata).toEqual({
      schemaVersion: 1,
      appName: 'Numens Fire Alarm Simulator',
      exportedAt: '2026-05-23T12:00:00.000Z',
      language: 'en'
    })
    expect(payload.project).not.toBe(project)
    expect(payload.assetPaths).toEqual([
      { packagePath: 'assets/maps/floor.png', sourcePath: 'C:/tmp/floor.png' }
    ])
    expect(payload.suggestedFileName).toBe('Saved Site.fireproj')
  })
})

function makeProject(): FireProject & {
  devices: []
  issues: []
  nonAddressableSounderPoints: []
} {
  return {
    schemaVersion: 1,
    projectId: 'project-1',
    name: 'Saved Site',
    createdAt: 1,
    updatedAt: 1,
    language: 'en',
    networks: [],
    buildings: [],
    assets: [
      {
        id: 'asset-1',
        kind: 'map',
        name: 'floor.png',
        packagePath: 'assets/maps/floor.png',
        runtimePath: 'C:/tmp/floor.png',
        mimeType: 'image/png'
      }
    ],
    viewSettings: {
      deviceIconScale2D: 1,
      deviceIconScale3D: 1,
      floorSpacing3D: 36,
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
