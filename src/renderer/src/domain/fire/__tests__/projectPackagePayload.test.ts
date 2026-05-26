import { describe, expect, it } from 'vitest'
import { reactive } from 'vue'
import type { FireDevice, FireProject } from '../types'
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

  it('serializes cleaned lifecycle state without orphan planning references', () => {
    const project = reactive(makeCleanedLifecycleProject())
    const payload = createFireProjectSavePayload(project, new Date('2026-05-23T12:00:00.000Z'))

    expect(payload.project.buildings.map((building) => building.id)).toEqual(['building-b'])
    expect(payload.project.devices).toMatchObject([
      { id: 'device-a', placement: { status: 'unplaced' } },
      {
        id: 'device-b',
        placement: {
          status: 'placed',
          buildingId: 'building-b',
          floorId: 'floor-b1'
        }
      }
    ])
    expect(
      payload.project.networks[0].panels[0].zones[0].visualAreas.map((area) => area.id)
    ).toEqual(['area-b1'])
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

function makeCleanedLifecycleProject(): FireProject & {
  devices: FireDevice[]
  issues: []
  nonAddressableSounderPoints: []
} {
  return {
    ...makeProject(),
    networks: [
      {
        id: 'network-1',
        name: 'Network 1',
        sourceFileName: 'site.cpd',
        sourceImportedAt: 1,
        sounderMode: 'Programmed',
        panels: [
          {
            id: 'panel-1',
            networkId: 'network-1',
            panelNumber: 1,
            panelName: 'Panel 1',
            general: {
              panelNumber: 1,
              sounderMode: 'Programmed',
              evacuateDelaySeconds: 0,
              sounderDelaySeconds: 0,
              inputOutputDelaySeconds: 0,
              fireBrigadeDelaySeconds: 0,
              onManualCallPoints: false,
              onTwoDevices: false,
              delayOffAtNight: false,
              raw: {}
            },
            loops: [],
            zones: [
              {
                id: 'zone-1',
                networkId: 'network-1',
                panelId: 'panel-1',
                zoneNumber: 1,
                text: 'Zone 1',
                enabled: true,
                delayedSounders: false,
                alarmMode: 'single',
                visualAreas: [
                  {
                    id: 'area-b1',
                    networkId: 'network-1',
                    panelId: 'panel-1',
                    zoneNumber: 1,
                    buildingId: 'building-b',
                    floorId: 'floor-b1',
                    kind: 'rectangle',
                    points: [
                      { x: 0, y: 0 },
                      { x: 100, y: 0 },
                      { x: 100, y: 100 },
                      { x: 0, y: 100 }
                    ],
                    color: '#ef4444',
                    opacity: 0.2
                  }
                ],
                raw: {}
              }
            ],
            sounderGroups: [],
            ioGroups: [],
            sounders: { raw: {} }
          }
        ]
      }
    ],
    buildings: [
      {
        id: 'building-b',
        name: 'Building B',
        floors: [{ id: 'floor-b1', buildingId: 'building-b', name: 'Floor B1', levelIndex: 0 }]
      }
    ],
    devices: [
      makePayloadDevice('device-a', { status: 'unplaced' }),
      makePayloadDevice('device-b', {
        status: 'placed',
        buildingId: 'building-b',
        floorId: 'floor-b1'
      })
    ]
  }
}

function makePayloadDevice(
  id: string,
  placement: { status: 'unplaced' } | { status: 'placed'; buildingId: string; floorId: string }
): FireDevice {
  return {
    id,
    networkId: 'network-1',
    panelId: 'panel-1',
    panelNumber: 1,
    type: 'manual_call_point',
    friendlyTypeName: 'Manual Call Point',
    isInputCapable: true,
    isOutputCapable: false,
    isSounder: false,
    isWirelessType: false,
    disabled: false,
    inhibitSounders: false,
    inhibitIO: false,
    inhibitRelays: false,
    evacuateIO: false,
    ioOverrideDelay: false,
    immediateEvacuate: false,
    setEvacuateTimer: false,
    overrideDelays: false,
    placement,
    raw: {}
  }
}
