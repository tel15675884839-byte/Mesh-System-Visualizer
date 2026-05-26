import type {
  FireDevice,
  FireLoop,
  FireNetwork,
  FireProject,
  FireZone,
  ZoneVisualArea
} from '../types'
import { DEFAULT_FLOOR_HEIGHT_3D } from '../viewer3DGeometry'

export function makeProject(): FireProject & { devices: FireDevice[] } {
  const network = makeNetwork('network-1')

  return {
    schemaVersion: 1,
    projectId: 'project-1',
    name: 'Test Project',
    createdAt: 1,
    updatedAt: 1,
    language: 'en',
    networks: [network],
    buildings: [],
    assets: [],
    viewSettings: {
      deviceIconScale2D: 1,
      deviceIconScale3D: 1,
      floorSpacing3D: DEFAULT_FLOOR_HEIGHT_3D,
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
      makeDevice('device-1', network.id, 'panel-1'),
      makeDevice('device-2', network.id, 'panel-1'),
      makeDevice('device-3', network.id, 'panel-1')
    ]
  }
}

export function makeLifecycleProject(): FireProject & { devices: FireDevice[] } {
  const project = makeProject()
  project.buildings = [
    {
      id: 'building-a',
      name: 'Building A',
      floors: [
        {
          id: 'floor-a1',
          buildingId: 'building-a',
          name: 'Floor A1',
          levelIndex: 0,
          mapAssetId: 'asset-a1',
          mapWidth: 900,
          mapHeight: 600,
          mapOpacity3D: 0.4
        },
        {
          id: 'floor-a2',
          buildingId: 'building-a',
          name: 'Floor A2',
          levelIndex: 1
        }
      ]
    },
    {
      id: 'building-b',
      name: 'Building B',
      floors: [
        {
          id: 'floor-b1',
          buildingId: 'building-b',
          name: 'Floor B1',
          levelIndex: 0,
          mapAssetId: 'asset-b1',
          mapWidth: 1000,
          mapHeight: 700,
          mapOpacity3D: 0.7
        }
      ]
    }
  ]
  project.assets = [
    {
      id: 'asset-a1',
      kind: 'map',
      name: 'Floor A1.png',
      packagePath: 'assets/maps/floor-a1.png',
      mimeType: 'image/png'
    },
    {
      id: 'asset-b1',
      kind: 'map',
      name: 'Floor B1.png',
      packagePath: 'assets/maps/floor-b1.png',
      mimeType: 'image/png'
    }
  ]
  project.devices = [
    makePlacedDevice('device-1', 'network-1', 'panel-1', 'building-a', 'floor-a1', 100, 100),
    makePlacedDevice('device-2', 'network-1', 'panel-1', 'building-a', 'floor-a2', 200, 200),
    makePlacedDevice('device-3', 'network-1', 'panel-1', 'building-b', 'floor-b1', 300, 300)
  ]
  project.networks[0].panels[0].zones[0].visualAreas = [
    makeZoneArea('area-a1', 'building-a', 'floor-a1'),
    makeZoneArea('area-a2', 'building-a', 'floor-a2'),
    makeZoneArea('area-b1', 'building-b', 'floor-b1')
  ]
  return project
}

export function makeNetwork(id: string): FireNetwork {
  const loop: FireLoop = {
    id: 'loop-1',
    networkId: id,
    panelId: 'panel-1',
    loopId: 1,
    name: 'Loop 1',
    configuredDeviceOrder: ['device-1', 'device-2', 'device-3'],
    manualDeviceOrder: [],
    color: '#2563eb'
  }
  const zone: FireZone = {
    id: 'zone-1',
    networkId: id,
    panelId: 'panel-1',
    zoneNumber: 1,
    text: 'Zone 1',
    enabled: true,
    delayedSounders: false,
    alarmMode: 'single',
    visualAreas: [],
    raw: {}
  }

  return {
    id,
    name: 'Network 1',
    sourceFileName: 'test.cpd',
    sourceImportedAt: 1,
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
        loops: [loop],
        zones: [zone],
        sounderGroups: [],
        ioGroups: [],
        sounders: { raw: {} }
      }
    ]
  }
}

export function makeDevice(
  id: string,
  networkId: string,
  panelId: string,
  zoneNumber?: number,
  sounderGroupId?: number,
  ioGroupId?: number
): FireDevice {
  return {
    id,
    networkId,
    panelId,
    panelNumber: 1,
    loopId: 1,
    address: Number(id.replace('device-', '')),
    type: 'manual_call_point',
    friendlyTypeName: 'Manual Call Point',
    zoneNumber,
    sounderGroupId,
    ioGroupId,
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
    raw: {}
  }
}

export function makePlacedDevice(
  id: string,
  networkId: string,
  panelId: string,
  buildingId: string,
  floorId: string,
  x: number,
  y: number
): FireDevice {
  return {
    ...makeDevice(id, networkId, panelId, 1),
    placement: {
      status: 'placed',
      buildingId,
      floorId,
      position: { x, y, z: 0 },
      order: Number(id.replace('device-', ''))
    }
  }
}

export function makeZoneArea(id: string, buildingId: string, floorId: string): ZoneVisualArea {
  return {
    id,
    networkId: 'network-1',
    panelId: 'panel-1',
    zoneNumber: 1,
    buildingId,
    floorId,
    kind: 'rectangle' as const,
    points: [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 }
    ],
    color: '#ef4444',
    opacity: 0.2
  }
}
