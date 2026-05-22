import { describe, expect, it } from 'vitest'
import { applyCpdDiff, diffCpdImport } from '../cpdDiff'
import type { CpdAdapterResult } from '../cpdAdapter'
import type { FireDevice, FireLoop, FireNetwork, FireProject, FireZone } from '../types'

describe('CPD re-import diff', () => {
  it('matches devices by panel number, loop, and address', () => {
    const existing = makeProject()
    const incoming = makeIncoming()

    const diff = diffCpdImport(existing, incoming)

    expect(diff.matched).toEqual([
      { existingDeviceId: 'existing-1', incomingDeviceId: 'incoming-1' }
    ])
    expect(diff.added).toEqual(['incoming-2'])
    expect(diff.removed).toEqual(['existing-2'])
  })

  it('reports changed CPD fields', () => {
    const existing = makeProject()
    const incoming = makeIncoming({
      matchedOverrides: {
        type: 'heat_det',
        friendlyTypeName: 'Heat Detector',
        zoneNumber: 2,
        sounderGroupId: 8
      }
    })

    const diff = diffCpdImport(existing, incoming)

    expect(diff.changed).toEqual([
      {
        deviceId: 'existing-1',
        fields: ['type', 'friendlyTypeName', 'zoneNumber', 'sounderGroupId']
      }
    ])
  })

  it('applies confirmed diff while preserving placement and planning state', () => {
    const existing = makeProject()
    const incoming = makeIncoming({
      matchedOverrides: {
        location: 'New Lobby'
      }
    })
    const diff = diffCpdImport(existing, incoming)

    const applied = applyCpdDiff(existing, incoming, diff) as FireProject & {
      devices: FireDevice[]
    }

    const matchedDevice = applied.devices.find((device) => device.id === 'existing-1')
    const addedDevice = applied.devices.find((device) => device.id === 'incoming-2')
    const removedDevice = applied.devices.find((device) => device.id === 'existing-2')

    expect(matchedDevice?.location).toBe('New Lobby')
    expect(matchedDevice?.placement).toEqual(existing.devices[0].placement)
    expect(addedDevice?.placement.status).toBe('unplaced')
    expect(removedDevice?.placement.status).toBe('missing')
    expect(applied.networks[0].panels[0].zones[0].visualAreas).toHaveLength(1)
    expect(applied.networks[0].panels[0].loops[0].manualDeviceOrder).toEqual(['existing-1'])
  })
})

function makeProject(): FireProject & { devices: FireDevice[] } {
  const loop = makeLoop('existing-1')
  const zone = makeZone()

  return {
    schemaVersion: 1,
    projectId: 'project-1',
    name: 'Existing',
    createdAt: 1,
    updatedAt: 1,
    language: 'en',
    networks: [makeNetwork('existing-network', [loop], [zone])],
    buildings: [],
    assets: [],
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
    devices: [
      makeDevice('existing-1', 1, 10, {
        placement: {
          status: 'placed',
          buildingId: 'building-1',
          floorId: 'floor-1',
          position: { x: 20, y: 30, z: 0 }
        }
      }),
      makeDevice('existing-2', 1, 20, {
        placement: {
          status: 'placed',
          buildingId: 'building-1',
          floorId: 'floor-1',
          position: { x: 50, y: 30, z: 0 }
        }
      })
    ]
  }
}

function makeIncoming(options: { matchedOverrides?: Partial<FireDevice> } = {}): CpdAdapterResult {
  return {
    projectName: 'Incoming',
    network: makeNetwork(
      'incoming-network',
      [makeLoop('incoming-1', 'incoming-2')],
      [makeZone(false)]
    ),
    devices: [
      makeDevice('incoming-1', 1, 10, options.matchedOverrides),
      makeDevice('incoming-2', 1, 30)
    ],
    issues: []
  }
}

function makeNetwork(id: string, loops: FireLoop[], zones: FireZone[]): FireNetwork {
  return {
    id,
    name: 'Network',
    sourceFileName: 'site.cpd',
    sourceImportedAt: 2,
    sounderMode: 'Programmed',
    panels: [
      {
        id: 'panel-1',
        networkId: id,
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
        loops,
        zones,
        sounderGroups: [],
        ioGroups: [],
        sounders: { raw: {} }
      }
    ]
  }
}

function makeLoop(...deviceIds: string[]): FireLoop {
  return {
    id: 'loop-1',
    networkId: 'network-1',
    panelId: 'panel-1',
    loopId: 1,
    name: 'Loop 1',
    configuredDeviceOrder: deviceIds,
    manualDeviceOrder: deviceIds.slice(0, 1),
    color: '#2563eb'
  }
}

function makeZone(withArea = true): FireZone {
  return {
    id: 'zone-1',
    networkId: 'network-1',
    panelId: 'panel-1',
    zoneNumber: 1,
    text: 'Lobby',
    enabled: true,
    delayedSounders: false,
    alarmMode: 'single',
    visualAreas: withArea
      ? [
          {
            id: 'area-1',
            networkId: 'network-1',
            panelId: 'panel-1',
            zoneNumber: 1,
            buildingId: 'building-1',
            floorId: 'floor-1',
            kind: 'rectangle',
            points: [
              { x: 0, y: 0 },
              { x: 10, y: 0 },
              { x: 10, y: 10 },
              { x: 0, y: 10 }
            ],
            color: '#ef4444',
            opacity: 0.2
          }
        ]
      : [],
    raw: {}
  }
}

function makeDevice(
  id: string,
  loopId: number,
  address: number,
  overrides: Partial<FireDevice> = {}
): FireDevice {
  return {
    id,
    networkId: 'network-1',
    panelId: 'panel-1',
    panelNumber: 1,
    loopId,
    address,
    type: 'smoke_detector',
    friendlyTypeName: 'Optical Detector',
    location: 'Lobby',
    zoneNumber: 1,
    sounderGroupId: 7,
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
    placement: { status: 'unplaced' },
    raw: {},
    ...overrides
  }
}
